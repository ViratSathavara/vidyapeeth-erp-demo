/**
 * Vercel serverless function: e-mails a fee receipt PDF.
 *
 * The browser app builds the PDF and posts it here. This function authenticates and validates the request,
 * then hands it to Resend (https://resend.com) over its HTTP API. No packages are needed.
 *
 * Environment variables (Vercel -> Project -> Settings -> Environment Variables):
 *   RESEND_API_KEY         required  API key from resend.com
 *   MAIL_FROM              required  e.g.  accounts@yourcollege.edu   (the domain must be verified in Resend)
 *   RECEIPT_API_KEY        required  shared secret, at least 24 random characters; type the same value in the app
 *                                    under Settings -> Email receipts. If it is missing or too short the function
 *                                    refuses every send (fail closed).
 *   MAIL_ALLOWED_DOMAINS   required  comma separated recipient domains, e.g. gmail.com,yourcollege.edu.
 *                                    (Set MAIL_ALLOW_ANY_DOMAIN=1 to deliberately allow any domain. Not advised.)
 *   ALLOWED_ORIGIN         recommended  the deployed site, e.g. https://erp.yourcollege.edu  (one origin, no wildcard).
 *                                    Unset = same-origin only and no CORS headers are sent.
 *   RECEIPT_DEMO_MODE      optional  "1" = demo mode: no key needed when RECEIPT_API_KEY is unset, requests are
 *                                    validated but NOTHING is sent. Ignored on Vercel production.
 *
 * Contract (kept stable for src/p4b_mail.js)
 *   POST  JSON { to:[email,...<=4], subject, html, text?, filename?, pdfBase64, fromName?, replyTo? }
 *         header x-api-key: <RECEIPT_API_KEY>
 *         200 { ok:true, id }   4xx/5xx { ok:false, error }
 *   GET   200 { ok:true, configured } (+ from, only when a valid x-api-key is sent)
 *   OPTIONS  CORS preflight (only for ALLOWED_ORIGIN)
 *   Full detail: company/projects/vidyapeeth-erp-shell/02-change-notes-api.md
 *
 * Security notes
 *  - No valid x-api-key (timing-safe compare) means nothing is sent, so this is not an open relay. Recipients are
 *    taken only from `to`; there is no cc/bcc and unknown fields are rejected.
 *  - Rate limiting here is IN MEMORY: each warm serverless instance has its own counters, so the real limit is
 *    (limit x number of instances) and counters reset on cold start. For production put the counters in a shared
 *    store (Upstash Redis / Vercel KV, same sliding-window logic) or use a Vercel Firewall rate-limit rule.
 *  - The key is typed into a browser in this demo. For production send the mail from the server that records the
 *    payment (after the gateway confirms it) so the key never reaches a browser.
 */
'use strict';
const crypto = require('crypto');

/* ---------------- limits ---------------- */
const MAX_RECIPIENTS = 4;
const MAX_SUBJECT = 200;
const MAX_HTML = 200000;
const MAX_TEXT = 20000;
const MAX_FROMNAME = 80;
const MAX_PDF_BYTES = 1000000;                               // decoded PDF
const MAX_PDF_B64 = Math.ceil(MAX_PDF_BYTES / 3) * 4;        // 1,333,336 base64 characters
const MAX_BODY_BYTES = MAX_PDF_B64 + MAX_HTML + MAX_TEXT + 20000; // whole JSON request
const MIN_KEY_LEN = 24;
const UPSTREAM_TIMEOUT_MS = 10000;
const RATE = {
  ipPerMin: { max: 20, win: 60000 },          // authenticated sends per client IP
  keyPerMin: { max: 60, win: 60000 },         // authenticated sends per shared key (all IPs)
  rcptPerHour: { max: 10, win: 3600000 },     // mails to one recipient address
  badAuthPerIp: { max: 20, win: 600000 },     // failed key attempts per IP, then 429
  anonPerIp: { max: 120, win: 60000 }         // any request per IP (GET / OPTIONS / bad key flood)
};
const ALLOWED_FIELDS = new Set(['to', 'subject', 'html', 'text', 'filename', 'pdfBase64', 'fromName', 'replyTo']);

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
const CTRL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;
const CTRL_G = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g;

/* ---------------- helpers ---------------- */
function isEmail(s) {
  return typeof s === 'string' && s.length <= 254 && EMAIL_RE.test(s) && !s.includes('..') &&
    !s.startsWith('.') && !s.split('@')[0].endsWith('.');
}
function sha(s) { return crypto.createHash('sha256').update(String(s)).digest(); }
function tag(s) { return sha(s).toString('hex').slice(0, 8); } // short non-reversible id for logs / limiter keys
/** Timing-safe string compare. Hashing first gives equal-length buffers, so length is not leaked. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return crypto.timingSafeEqual(sha(a), sha(b));
}
function hdr(req, name) {
  const v = req.headers && req.headers[name];
  return Array.isArray(v) ? v[0] : (typeof v === 'string' ? v : '');
}
function log(event, f) { // structured, no personal data, no secrets: counts and short hashes only
  try { console.log(JSON.stringify(Object.assign({ svc: 'send-receipt', event, t: new Date().toISOString() }, f))); } catch (e) { /* ignore */ }
}

/* ---------------- sliding-window limiter (in memory, per instance) ---------------- */
const MAX_TRACKED = 5000;
function makeLimiter() {
  const store = new Map(); // key -> ascending array of timestamps
  const live = (key, win, now) => {
    const l = (store.get(key) || []).filter(t => now - t < win);
    if (l.length) store.set(key, l); else store.delete(key);
    return l;
  };
  const trim = (now) => {
    if (store.size <= MAX_TRACKED) return;
    for (const [k, l] of store) { if (now - l[l.length - 1] > 3600000) store.delete(k); }
    while (store.size > MAX_TRACKED) store.delete(store.keys().next().value); // evict oldest, never clear all
  };
  return {
    /** Would one more event fit? Does not record. */
    peek(key, rule, now) {
      const l = live(key, rule.win, now);
      return l.length < rule.max ? { ok: true } : { ok: false, retry: Math.max(1, Math.ceil((rule.win - (now - l[0])) / 1000)) };
    },
    /** Record one event (capped so memory per key stays bounded). */
    add(key, rule, now) {
      const l = live(key, rule.win, now);
      if (l.length < rule.max + 1) l.push(now);
      store.set(key, l); trim(now);
    }
  };
}
const limiter = makeLimiter();
/** Check all rules; record only when every rule passes (a refused request must not extend the window). */
function takeAll(items, now) {
  for (const [k, rule] of items) { const r = limiter.peek(k, rule, now); if (!r.ok) return r; }
  for (const [k, rule] of items) limiter.add(k, rule, now);
  return { ok: true };
}

/* ---------------- config, origin, ip ---------------- */
function isProd() { return process.env.VERCEL_ENV ? process.env.VERCEL_ENV === 'production' : process.env.NODE_ENV === 'production'; }
function config() {
  const e = process.env;
  const key = e.RECEIPT_API_KEY || '';
  const demo = e.RECEIPT_DEMO_MODE === '1' && !isProd() && !key;
  const domains = (e.MAIL_ALLOWED_DOMAINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const anyDomain = e.MAIL_ALLOW_ANY_DOMAIN === '1';
  let problem = '';
  if (demo) return { ok: true, demo: true, domains, anyDomain: true, from: e.MAIL_FROM || 'demo@example.invalid', key: '' };
  if (!e.RESEND_API_KEY) problem = 'RESEND_API_KEY missing';
  else if (!isEmail((e.MAIL_FROM || '').trim())) problem = 'MAIL_FROM missing or invalid';
  else if (!key) problem = 'RECEIPT_API_KEY missing';
  else if (key.length < MIN_KEY_LEN || CTRL.test(key)) problem = 'RECEIPT_API_KEY too short';
  else if (!domains.length && !anyDomain) problem = 'MAIL_ALLOWED_DOMAINS missing';
  return { ok: !problem, problem, demo: false, domains, anyDomain, from: (e.MAIL_FROM || '').trim(), key };
}
function normalizeOrigin(v) {
  v = String(v || '').trim();
  if (!v || v.includes('*')) return '';
  try { const u = new URL(v); return (u.protocol === 'https:' || u.protocol === 'http:') ? u.origin : ''; } catch (e) { return ''; }
}
/** { ok, cors } cors = origin to echo in Access-Control-Allow-Origin, or ''. No wildcard is ever sent. */
function originPolicy(req) {
  const origin = hdr(req, 'origin');
  const configured = process.env.ALLOWED_ORIGIN;
  const allowed = normalizeOrigin(configured);
  if (!origin) return { ok: true, cors: '' };                     // server-to-server / same-origin GET: key still required
  if (configured && !allowed) return { ok: false, cors: '' };     // ALLOWED_ORIGIN set but invalid or wildcard: fail closed
  if (allowed) return origin === allowed ? { ok: true, cors: allowed } : { ok: false, cors: '' };
  try { return { ok: new URL(origin).host === hdr(req, 'host'), cors: '' }; } catch (e) { return { ok: false, cors: '' }; } // unset: same-origin only
}
function clientIp(req) {
  const net = require('net');
  const c = [hdr(req, 'x-vercel-forwarded-for'), hdr(req, 'x-real-ip'), hdr(req, 'x-forwarded-for').split(',')[0],
    (req.socket && req.socket.remoteAddress) || ''].map(s => s.trim());
  for (const x of c) if (x && net.isIP(x)) return x;
  return 'unknown';
}

/* ---------------- body ---------------- */
function readBody(req, max) { // used only when the platform did not already parse the body
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0, done = false;
    req.on('data', c => { if (done) return; n += c.length; if (n > max) { done = true; chunks.length = 0; reject(Object.assign(new Error('too large'), { code: 'E_BIG' })); } else chunks.push(c); });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', e => { if (!done) { done = true; reject(e); } });
  });
}

/* ---------------- validation ---------------- */
function bad(msg) { return { error: msg }; }
function validate(b, cfg) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return bad('Bad request');
  for (const k of Object.keys(b)) if (!ALLOWED_FIELDS.has(k)) return bad('Bad request: unknown field');

  if (!Array.isArray(b.to) || b.to.length < 1) return bad('Recipient address is not valid');
  if (b.to.length > MAX_RECIPIENTS) return bad('Too many recipients (maximum ' + MAX_RECIPIENTS + ')');
  const to = [], seen = new Set();
  for (const x of b.to) {
    if (typeof x !== 'string') return bad('Recipient address is not valid');
    const a = x.trim();
    if (!isEmail(a)) return bad('Recipient address is not valid');
    if (seen.has(a.toLowerCase())) continue;
    seen.add(a.toLowerCase()); to.push(a);
  }
  if (!cfg.anyDomain && !to.every(a => cfg.domains.includes(a.split('@')[1].toLowerCase()))) return bad('This recipient domain is not allowed');

  if (typeof b.subject !== 'string') return bad('Subject is missing or invalid');
  const subject = b.subject.replace(CTRL_G, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SUBJECT); // header field: no CR/LF
  if (!subject) return bad('Subject is missing or invalid');

  if (typeof b.html !== 'string' || !b.html || b.html.length > MAX_HTML) return bad('Message body is missing or too large');
  let text = '';
  if (b.text != null) { if (typeof b.text !== 'string' || b.text.length > MAX_TEXT) return bad('Text body is invalid or too large'); text = b.text; }

  const filename = b.filename == null || b.filename === '' ? 'receipt.pdf' : b.filename;
  if (typeof filename !== 'string' || !/^[\w.-]{1,80}\.pdf$/i.test(filename) || filename.includes('..')) return bad('Bad attachment name');

  const pdf = b.pdfBase64;
  if (typeof pdf !== 'string' || !pdf) return bad('Attachment is not a valid PDF');
  if (pdf.length > MAX_PDF_B64) return bad('Attachment is too large (maximum ' + Math.floor(MAX_PDF_BYTES / 1000) + ' KB)');
  if (pdf.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(pdf)) return bad('Attachment is not a valid PDF');
  const raw = Buffer.from(pdf, 'base64');
  if (raw.length > MAX_PDF_BYTES) return bad('Attachment is too large (maximum ' + Math.floor(MAX_PDF_BYTES / 1000) + ' KB)');
  if (raw.slice(0, 5).toString('latin1') !== '%PDF-' || !raw.slice(-1024).toString('latin1').includes('%%EOF')) return bad('Attachment is not a valid PDF');

  let replyTo;
  if (b.replyTo != null && b.replyTo !== '') {
    if (typeof b.replyTo !== 'string' || !isEmail(b.replyTo.trim())) return bad('Reply-to address is not valid');
    replyTo = b.replyTo.trim();
  }
  if (b.fromName != null && typeof b.fromName !== 'string') return bad('Sender name is invalid');
  // display name: no CR/LF/control chars, no <>"@,;:\ so it cannot smuggle an address or break the header
  const fromName = String(b.fromName || '').replace(CTRL_G, ' ').replace(/[<>"@,;:\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_FROMNAME);
  return { value: { to, subject, html: b.html, text, filename, pdf, replyTo, fromName } };
}

/* ---------------- handler ---------------- */
module.exports = async function handler(req, res) {
  const now = Date.now();
  const ip = clientIp(req), ipTag = tag(ip);
  let cors = '';
  const send = (code, body, extra) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('vary', 'Origin');
    if (cors) res.setHeader('access-control-allow-origin', cors);
    if (extra) for (const k of Object.keys(extra)) res.setHeader(k, extra[k]);
    res.end(code === 204 ? undefined : JSON.stringify(body));
  };
  const fail = (code, error, ev, extra) => { log(ev || 'rejected', { status: code, ip: ipTag }); return send(code, { ok: false, error }, extra); };

  try {
    // 1. origin (browsers only; non-browser callers have no Origin and are still gated by the key)
    const op = originPolicy(req);
    if (!op.ok) return fail(403, 'Origin not allowed', 'bad_origin');
    cors = op.cors;

    // 2. method
    if (req.method === 'OPTIONS') {
      if (hdr(req, 'origin') && !cors) return fail(403, 'Origin not allowed', 'bad_origin');
      return send(204, null, { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-api-key', 'access-control-max-age': '600', allow: 'GET, POST, OPTIONS' });
    }
    if (req.method !== 'GET' && req.method !== 'POST') return fail(405, 'Use POST', 'bad_method', { allow: 'GET, POST, OPTIONS' });

    // 3. cheap flood guard before any work
    const anon = takeAll([['anon:' + ip, RATE.anonPerIp]], now);
    if (!anon.ok) return fail(429, 'Too many requests. Wait a minute and try again.', 'rate_anon', { 'retry-after': String(anon.retry) });

    const cfg = config();
    const given = hdr(req, 'x-api-key').slice(0, 512);

    // 4. GET = status probe used by "Check mail server". Never reveals the sender address without the key.
    if (req.method === 'GET') {
      const keyOk = cfg.ok && !cfg.demo && safeEqual(given, cfg.key);
      return send(200, { ok: true, configured: cfg.ok, from: keyOk ? cfg.from : undefined });
    }

    // 5. POST: fail closed when not configured
    if (!cfg.ok) { log('not_configured', { reason: cfg.problem, ip: ipTag }); return send(503, { ok: false, error: 'Mail server is not set up yet. Ask the administrator to finish the setup in Vercel.' }); }

    // 6. content type and declared size, before reading the body
    if (!/^application\/json\b/i.test(hdr(req, 'content-type'))) return fail(415, 'Send JSON', 'bad_type');
    const declared = parseInt(hdr(req, 'content-length'), 10);
    if (declared > MAX_BODY_BYTES) return fail(413, 'Request is too large', 'too_large');

    // 7. authentication (timing-safe). Demo mode with no configured key skips this, and never sends mail.
    if (!cfg.demo) {
      const badKey = 'bad:' + ip;
      if (!safeEqual(given, cfg.key)) {
        limiter.add(badKey, RATE.badAuthPerIp, now);
        const lock = limiter.peek(badKey, RATE.badAuthPerIp, now);
        if (!lock.ok) return fail(429, 'Too many failed attempts. Try again later.', 'rate_badauth', { 'retry-after': String(lock.retry) });
        return fail(401, 'Wrong access key. Check Settings -> Email receipts.', 'auth_fail');
      }
    }

    // 8. rate limits for authenticated sends (per IP and per key). A valid key is never locked out by bad guesses.
    const keyTag = cfg.demo ? 'demo' : tag(cfg.key);
    const rl = takeAll([['ip:' + ip, RATE.ipPerMin], ['key:' + keyTag, RATE.keyPerMin]], now);
    if (!rl.ok) return fail(429, 'Too many emails. Wait a minute and try again.', 'rate_send', { 'retry-after': String(rl.retry) });

    // 9. body (platform-parsed or streamed with a hard cap)
    let b = req.body;
    if (b === undefined || b === null) {
      try { b = await readBody(req, MAX_BODY_BYTES); }
      catch (e) {
        if (e && e.code === 'E_BIG') { res.once && res.once('finish', () => { try { req.destroy(); } catch (x) { /* ignore */ } }); return fail(413, 'Request is too large', 'too_large', { connection: 'close' }); }
        return fail(400, 'Bad request', 'read_error');
      }
    }
    if (Buffer.isBuffer(b)) b = b.toString('utf8');
    if (typeof b === 'string') {
      if (Buffer.byteLength(b) > MAX_BODY_BYTES) return fail(413, 'Request is too large', 'too_large');
      try { b = JSON.parse(b); } catch (e) { return fail(400, 'Bad request', 'bad_json'); }
    }
    const v = validate(b, cfg);
    if (v.error) return fail(400, v.error, 'invalid');
    const m = v.value;

    // 10. per-recipient cap (stops one inbox being mail-bombed even with a valid key)
    const rc = takeAll(m.to.map(a => ['rcpt:' + a.toLowerCase(), RATE.rcptPerHour]), now);
    if (!rc.ok) return fail(429, 'Too many emails to this recipient. Try again later.', 'rate_rcpt', { 'retry-after': String(rc.retry) });

    // 11. send
    if (cfg.demo) { log('demo_accepted', { recipients: m.to.length, ip: ipTag }); return send(200, { ok: true, id: 'demo-' + crypto.randomBytes(6).toString('hex'), demo: true }); }
    const from = m.fromName ? `${m.fromName} <${cfg.from}>` : cfg.from;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: ac.signal,
        headers: { authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: m.to, reply_to: m.replyTo, subject: m.subject, html: m.html, text: m.text || undefined, attachments: [{ filename: m.filename, content: m.pdf }] })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { log('provider_error', { status: r.status, recipients: m.to.length, ip: ipTag }); return send(502, { ok: false, error: 'The mail provider could not send this email' }); }
      log('sent', { recipients: m.to.length, pdfBytes: Math.floor(m.pdf.length * 3 / 4), ip: ipTag });
      return send(200, { ok: true, id: typeof j.id === 'string' ? j.id.slice(0, 100) : undefined });
    } catch (e) {
      log('provider_unreachable', { aborted: !!(e && e.name === 'AbortError'), ip: ipTag });
      return send(502, { ok: false, error: 'Could not reach the mail provider' });
    } finally { clearTimeout(timer); }
  } catch (e) { // never leak stack traces or messages
    log('internal_error', { name: e && e.name, ip: ipTag });
    try { return send(500, { ok: false, error: 'Something went wrong. Try again.' }); } catch (x) { /* response already sent */ }
  }
};
