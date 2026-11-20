/**
 * Vercel serverless function: sends the ERP's emails for real through Resend (https://resend.com).
 * The app builds each email (HTML + text, optional receipt PDF) and posts it here; this function checks the
 * request and hands it to Resend's HTTP API. No packages needed (Node 18+ fetch).
 *
 * Environment variables (Vercel -> Project -> Settings -> Environment Variables):
 *   RESEND_API_KEY        required  API key from resend.com (starts with re_)
 *   MAIL_FROM             required  sender, e.g.  NPCTE College <noreply@yourdomain.com>
 *                                   The domain must be verified in Resend. For a first test you may use
 *                                   onboarding@resend.dev, but then Resend delivers only to your own Resend login email.
 *   MAIL_ACCESS_KEY       required  shared secret (32+ characters). The same value is inside the demo's encrypted data,
 *                                   so only a browser that unlocked the demo with its password can send. Wrong or
 *                                   missing key = nothing is sent (fail closed).
 *   MAIL_REPLY_TO         optional  where replies go, e.g. npcte@yahoo.co.in
 *   MAIL_ALLOWED_DOMAINS  optional  comma separated recipient domains (e.g. gmail.com,yahoo.com). Empty = any domain.
 *
 * Contract
 *   GET   -> 200 { ok:true, configured:boolean }           (no secrets in the answer)
 *   POST  JSON { to:[email] (1-3), subject, html, text?, attachment?:{ filename:"*.pdf", content:<base64 PDF> } }
 *         header x-mail-key: <MAIL_ACCESS_KEY>
 *         -> 200 { ok:true, id }   |   4xx/5xx { ok:false, error }
 *
 * Limits are kept in memory per warm instance (good enough for a demo): 40 sends / minute per IP,
 * 12 sends / hour per recipient, 20 wrong keys / 10 minutes per IP.
 */
'use strict';
const crypto = require('crypto');

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
const configured = () => !!(env('RESEND_API_KEY') && env('MAIL_FROM') && env('MAIL_ACCESS_KEY').length >= 24);
function same(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function send(res, code, obj) { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); }

module.exports = async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'x';
  if (req.method === 'GET') return send(res, 200, { ok: true, configured: configured() });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(res, 405, { ok: false, error: 'Method not allowed' }); }
  /* same-site only: a browser on another site cannot post here */
  const origin = req.headers.origin; const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host && new URL(origin).host !== host) return send(res, 403, { ok: false, error: 'Wrong origin' });
  if (!configured()) return send(res, 503, { ok: false, error: 'Email is not set up on the server (RESEND_API_KEY, MAIL_FROM, MAIL_ACCESS_KEY)' });
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
  for (const e of to) if (limited('rc:' + e, 12, 3600000)) return send(res, 429, { ok: false, error: 'Too many emails to ' + e + ' this hour' });
  const subject = String(b.subject || '').replace(/[\r\n]+/g, ' ').trim();
  if (!subject || subject.length > MAX.subject) return send(res, 400, { ok: false, error: 'Invalid subject' });
  const html = String(b.html || ''), text = String(b.text || '');
  if (!html || html.length > MAX.html || text.length > MAX.text) return send(res, 400, { ok: false, error: 'Invalid body' });
  const mail = { from: env('MAIL_FROM'), to, subject, html, text: text || undefined };
  if (env('MAIL_REPLY_TO') && EMAIL_RE.test(env('MAIL_REPLY_TO'))) mail.reply_to = env('MAIL_REPLY_TO');
  if (b.attachment) {
    const a = b.attachment, name = String(a.filename || '');
    if (!/^[\w.-]{1,80}\.pdf$/i.test(name) || typeof a.content !== 'string') return send(res, 400, { ok: false, error: 'Invalid attachment' });
    const buf = Buffer.from(a.content, 'base64');
    if (!buf.length || buf.length > MAX.pdf || buf.subarray(0, 5).toString() !== '%PDF-') return send(res, 400, { ok: false, error: 'Attachment must be a PDF under 1 MB' });
    mail.attachments = [{ filename: name, content: a.content }];
  }
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(env('RESEND_API_URL') || 'https://api.resend.com/emails', { method: 'POST', signal: ctl.signal,
      headers: { Authorization: 'Bearer ' + env('RESEND_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify(mail) });
    clearTimeout(t);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return send(res, 502, { ok: false, error: 'Resend: ' + (j.message || j.name || ('HTTP ' + r.status)) });
    return send(res, 200, { ok: true, id: j.id || '' });
  } catch (e) {
    return send(res, 502, { ok: false, error: e.name === 'AbortError' ? 'Mail server timed out' : 'Could not reach the mail server' });
  }
};
