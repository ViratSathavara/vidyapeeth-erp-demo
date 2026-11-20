/**
 * Vercel serverless function: sends the ERP's emails for real over SMTP (e.g. Gmail with an App Password).
 * The app builds each email (HTML + text, optional receipt PDF) and posts it here; this function checks the
 * request, builds the MIME message and sends it with a small built-in SMTP client (no packages needed).
 *
 * Environment variables (Vercel -> Project -> Settings -> Environment Variables):
 *   SMTP_USER        required  the mailbox, e.g. npcte.office@gmail.com
 *   SMTP_PASS        required  Gmail: the 16-character App Password (spaces are removed automatically)
 *   MAIL_ACCESS_KEY  required  shared secret (24+ characters). The same value is inside the demo's encrypted data,
 *                              so only a browser that unlocked the demo with its password can send (fail closed).
 *   SMTP_HOST        optional  default smtp.gmail.com
 *   SMTP_PORT        optional  default 465 (TLS from the start). 587 = STARTTLS.
 *   SMTP_SECURE      optional  true/false to force TLS-from-start; normally leave empty (465 = true, else STARTTLS)
 *   MAIL_FROM_NAME   optional  sender name, default "NPCTE College"
 *   MAIL_FROM        optional  sender address, default SMTP_USER (Gmail only allows your own address or a verified alias)
 *   MAIL_REPLY_TO    optional  where replies go, e.g. npcte@yahoo.co.in
 *   MAIL_ALLOWED_DOMAINS optional comma separated recipient domains (e.g. gmail.com,yahoo.com). Empty = any.
 *
 * Contract
 *   GET   -> 200 { ok:true, configured:boolean }           (no secrets in the answer)
 *   POST  JSON { to:[email] (1-3), subject, html, text?, attachment?:{ filename:"*.pdf", content:<base64 PDF> } }
 *         header x-mail-key: <MAIL_ACCESS_KEY>
 *         -> 200 { ok:true, id }   |   4xx/5xx { ok:false, error }
 *
 * Limits are kept in memory per warm instance (good enough for a demo): 40 sends / minute per IP,
 * 12 sends / hour per recipient, 20 wrong keys / 10 minutes per IP. Gmail itself allows about 500 a day.
 */
'use strict';
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
const MAX = { to: 3, subject: 200, html: 200000, text: 20000, pdf: 1000000 };
const FIELDS = new Set(['to', 'subject', 'html', 'text', 'attachment']);
const hits = new Map();
function limited(key, max, win) {
  const now = Date.now(); const l = (hits.get(key) || []).filter(t => now - t < win);
  if (l.length >= max) { hits.set(key, l); return true; }
  l.push(now); hits.set(key, l); if (hits.size > 5000) hits.clear(); return false;
}
const env = k => String(process.env[k] || '').trim();
const smtpCfg = () => ({
  host: env('SMTP_HOST') || 'smtp.gmail.com', port: +env('SMTP_PORT') || 465,
  user: env('SMTP_USER'), pass: env('SMTP_PASS').replace(/\s+/g, ''),
  from: env('MAIL_FROM') || env('SMTP_USER'), fromName: env('MAIL_FROM_NAME') || 'NPCTE College', replyTo: env('MAIL_REPLY_TO')
});
const configured = () => { const c = smtpCfg(); return !!(c.user && c.pass && EMAIL_RE.test(c.from) && env('MAIL_ACCESS_KEY').length >= 24); };
function same(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function send(res, code, obj) { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); }

/* ---------- MIME message (multipart/alternative text + html, optional PDF attachment) ---------- */
const b64lines = buf => buf.toString('base64').replace(/.{1,76}/g, '$&\r\n');
const ascii = s => /^[\x20-\x7e]*$/.test(s);
const encWord = s => ascii(s) ? s : '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?=';
const mailbox = (name, email) => name ? (ascii(name) ? `"${name.replace(/["\\]/g, '')}"` : encWord(name)) + ` <${email}>` : email;
function mime(c, m) {
  const id = crypto.randomBytes(12).toString('hex'), alt = 'alt_' + id, mix = 'mix_' + id;
  const H = [`From: ${mailbox(c.fromName, c.from)}`, `To: ${m.to.join(', ')}`, `Subject: ${encWord(m.subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`, `Message-ID: <${id}@${c.from.split('@')[1]}>`, 'MIME-Version: 1.0'];
  if (c.replyTo && EMAIL_RE.test(c.replyTo)) H.push(`Reply-To: ${c.replyTo}`);
  const altPart = `--${alt}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64lines(Buffer.from(m.text || ' ', 'utf8'))}` +
    `--${alt}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64lines(Buffer.from(m.html, 'utf8'))}--${alt}--\r\n`;
  if (!m.attachment) return H.join('\r\n') + `\r\nContent-Type: multipart/alternative; boundary="${alt}"\r\n\r\n` + altPart;
  return H.join('\r\n') + `\r\nContent-Type: multipart/mixed; boundary="${mix}"\r\n\r\n--${mix}\r\nContent-Type: multipart/alternative; boundary="${alt}"\r\n\r\n` + altPart +
    `--${mix}\r\nContent-Type: application/pdf; name="${m.attachment.filename}"\r\nContent-Disposition: attachment; filename="${m.attachment.filename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n` +
    b64lines(m.attachment.buf) + `--${mix}--\r\n`;
}

/* ---------- a small SMTP client: implicit TLS (465) or STARTTLS (587), AUTH LOGIN ---------- */
async function smtpSend(c, rcpts, raw) {
  const secure = env('SMTP_SECURE') ? env('SMTP_SECURE').toLowerCase() === 'true' : c.port === 465;
  const tlsOpts = { servername: c.host, rejectUnauthorized: process.env.SMTP_INSECURE_TEST !== '1' };
  let sock = await new Promise((ok, bad) => {
    const s = secure ? tls.connect({ host: c.host, port: c.port, ...tlsOpts }, () => ok(s)) : net.connect({ host: c.host, port: c.port }, () => ok(s));
    s.once('error', bad);
  });
  sock.setTimeout(20000, () => sock.destroy(new Error('Mail server timed out')));
  let buf = '', pend = null, err = null;
  const flush = () => {
    if (!pend) return;
    const m = buf.match(/^(?:\d{3}-[^\r\n]*\r?\n)*(\d{3})(?: [^\r\n]*)?\r?\n/); if (!m) return;
    buf = buf.slice(m[0].length); const p = pend; pend = null; p.ok({ code: +m[1], text: m[0].trim() });
  };
  const onData = d => { buf += d.toString('utf8'); flush(); };
  const onErr = e => { err = err || e; if (pend) { const p = pend; pend = null; p.bad(err); } };
  const onClose = () => onErr(new Error('Mail server closed the connection'));
  const bind = s => { s.on('data', onData); s.on('error', onErr); s.on('close', onClose); };
  const unbind = s => { s.off('data', onData); s.off('error', onErr); s.off('close', onClose); };
  const read = () => new Promise((ok, bad) => { if (err) return bad(err); pend = { ok, bad }; flush(); });
  const cmd = async (line, okCodes) => {
    if (line != null) sock.write(line + '\r\n');
    const r = await read();
    if (!okCodes.includes(r.code)) {
      const last = r.text.split(/\r?\n/).pop().replace(/^\d{3}[ -]/, '');
      throw new Error(`Mail server (${r.code}): ${last.slice(0, 180)}`);
    }
    return r;
  };
  bind(sock);
  try {
    await cmd(null, [220]);
    let ehlo = await cmd('EHLO npcte-erp', [250]);
    if (!secure) {
      if (!/STARTTLS/i.test(ehlo.text)) throw new Error('Mail server does not offer STARTTLS on port ' + c.port);
      await cmd('STARTTLS', [220]); unbind(sock);
      sock = await new Promise((ok, bad) => { const t = tls.connect({ socket: sock, ...tlsOpts }, () => ok(t)); t.once('error', bad); });
      sock.setTimeout(20000, () => sock.destroy(new Error('Mail server timed out')));
      bind(sock); ehlo = await cmd('EHLO npcte-erp', [250]);
    }
    try {
      await cmd('AUTH LOGIN', [334]);
      await cmd(Buffer.from(c.user).toString('base64'), [334]);
      await cmd(Buffer.from(c.pass).toString('base64'), [235]);
    } catch (e) {
      throw new Error(/\(53[45]\)/.test(e.message) ? 'Login to the mail server failed: check SMTP_USER and the App Password' : e.message);
    }
    await cmd(`MAIL FROM:<${c.from}>`, [250]);
    for (const r of rcpts) await cmd(`RCPT TO:<${r}>`, [250, 251]);
    await cmd('DATA', [354]);
    sock.write(raw.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..') + '\r\n.\r\n');
    const done = await cmd(null, [250]);
    try { sock.write('QUIT\r\n'); } catch (e) { /* ignore */ }
    return (done.text.match(/[\w.@-]{8,}/g) || []).pop() || 'sent';
  } finally {
    setTimeout(() => { try { sock.destroy(); } catch (e) { /* ignore */ } }, 300);
  }
}

module.exports = async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim() || 'x';
  if (req.method === 'GET') return send(res, 200, { ok: true, configured: configured() });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(res, 405, { ok: false, error: 'Method not allowed' }); }
  /* same-site only: a browser on another site cannot post here */
  const origin = req.headers.origin; const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host) { let oh = ''; try { oh = new URL(origin).host; } catch (e) { /* bad origin */ } if (oh !== host) return send(res, 403, { ok: false, error: 'Wrong origin' }); }
  if (!configured()) return send(res, 503, { ok: false, error: 'Email is not set up on the server (SMTP_USER, SMTP_PASS, MAIL_ACCESS_KEY)' });
  if (!same(req.headers['x-mail-key'] || '', env('MAIL_ACCESS_KEY'))) {
    const tooMany = limited('bad:' + ip, 20, 600000);
    return send(res, tooMany ? 429 : 401, { ok: false, error: tooMany ? 'Too many attempts' : 'Not allowed to send email' });
  }
  if (limited('ip:' + ip, 40, 60000)) return send(res, 429, { ok: false, error: 'Too many emails, wait a minute' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { return send(res, 400, { ok: false, error: 'Bad JSON' }); } }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return send(res, 400, { ok: false, error: 'Bad request' });
  for (const k of Object.keys(b)) if (!FIELDS.has(k)) return send(res, 400, { ok: false, error: 'Unknown field ' + k });
  const to = Array.isArray(b.to) ? b.to.map(x => String(x).trim().toLowerCase()) : [];
  if (!to.length || to.length > MAX.to || !to.every(e => EMAIL_RE.test(e))) return send(res, 400, { ok: false, error: 'Invalid recipient' });
  const allow = env('MAIL_ALLOWED_DOMAINS').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  if (allow.length && !to.every(e => allow.includes(e.split('@')[1]))) return send(res, 400, { ok: false, error: 'Recipient domain not allowed' });
  const subject = String(b.subject || '').replace(/[\r\n]+/g, ' ').trim();
  if (!subject || subject.length > MAX.subject) return send(res, 400, { ok: false, error: 'Invalid subject' });
  const html = String(b.html || ''), text = String(b.text || '');
  if (!html || html.length > MAX.html || text.length > MAX.text) return send(res, 400, { ok: false, error: 'Invalid body' });
  const m = { to, subject, html, text };
  if (b.attachment) {
    const a = b.attachment, name = String(a.filename || '');
    if (!/^[\w.-]{1,80}\.pdf$/i.test(name) || typeof a.content !== 'string') return send(res, 400, { ok: false, error: 'Invalid attachment' });
    const buf = Buffer.from(a.content, 'base64');
    if (!buf.length || buf.length > MAX.pdf || buf.subarray(0, 5).toString() !== '%PDF-') return send(res, 400, { ok: false, error: 'Attachment must be a PDF under 1 MB' });
    m.attachment = { filename: name, buf };
  }
  for (const e of to) if (limited('rc:' + e, 12, 3600000)) return send(res, 429, { ok: false, error: 'Too many emails to ' + e + ' this hour' });
  try {
    const c = smtpCfg();
    const id = await smtpSend(c, to, mime(c, m));
    return send(res, 200, { ok: true, id });
  } catch (e) {
    return send(res, 502, { ok: false, error: String((e && e.message) || 'Could not send the email').slice(0, 240) });
  }
};
