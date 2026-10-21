/**
 * Vercel serverless function: e-mails a fee receipt PDF.
 *
 * The browser app builds the PDF and posts it here. This function checks the request and hands it to
 * Resend (https://resend.com) using its HTTP API. No packages are needed.
 *
 * Environment variables (Vercel -> Project -> Settings -> Environment Variables):
 *   RESEND_API_KEY        required  API key from resend.com
 *   MAIL_FROM             required  e.g.  accounts@yourcollege.edu   (the domain must be verified in Resend)
 *   RECEIPT_API_KEY       required  a long random password; type the same value in the app under Settings -> Email receipts
 *   MAIL_ALLOWED_DOMAINS  optional  comma separated, e.g. gmail.com,yourcollege.edu  (only these recipient domains are accepted)
 *
 * Security notes
 *  - Without the right x-api-key header the function sends nothing, so it cannot be used as an open mail relay.
 *  - The key is typed into the app by the administrator. That is fine for a demo. For production, call this logic
 *    from the server that records the payment (payment webhook), so the key never reaches a browser.
 */
const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;
const hits = new Map(); // best-effort rate limit per warm instance

function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function limited(ip) {
  const now = Date.now(), win = 60000, max = 40;
  const list = (hits.get(ip) || []).filter(t => now - t < win);
  list.push(now); hits.set(ip, list);
  if (hits.size > 500) hits.clear();
  return list.length > max;
}
function reply(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const configured = !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM && process.env.RECEIPT_API_KEY);

  if (req.method === 'GET') return reply(res, 200, { ok: true, configured, from: configured ? process.env.MAIL_FROM : undefined });
  if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'Use POST' });
  if (!configured) return reply(res, 503, { ok: false, error: 'Mail server is not set up yet. Add RESEND_API_KEY, MAIL_FROM and RECEIPT_API_KEY in Vercel and redeploy.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return reply(res, 429, { ok: false, error: 'Too many emails. Wait a minute and try again.' });
  if (!safeEqual(req.headers['x-api-key'], process.env.RECEIPT_API_KEY)) return reply(res, 401, { ok: false, error: 'Wrong access key. Check Settings -> Email receipts.' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') return reply(res, 400, { ok: false, error: 'Bad request' });

  const to = Array.isArray(b.to) ? b.to.map(x => String(x).trim()) : [];
  if (!to.length || to.length > 3 || !to.every(x => EMAIL.test(x))) return reply(res, 400, { ok: false, error: 'Recipient address is not valid' });
  const allowed = (process.env.MAIL_ALLOWED_DOMAINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !to.every(x => allowed.includes(x.split('@')[1].toLowerCase()))) return reply(res, 400, { ok: false, error: 'This recipient domain is not allowed' });

  const subject = String(b.subject || '').slice(0, 200);
  const html = String(b.html || '');
  const text = String(b.text || '').slice(0, 20000);
  const filename = String(b.filename || 'receipt.pdf');
  const pdf = String(b.pdfBase64 || '');
  if (!subject || !html || html.length > 200000) return reply(res, 400, { ok: false, error: 'Subject or body is missing or too large' });
  if (!/^[\w.-]{1,80}\.pdf$/i.test(filename)) return reply(res, 400, { ok: false, error: 'Bad attachment name' });
  if (!/^JVBERi0/.test(pdf) || pdf.length > 1500000 || !/^[A-Za-z0-9+/=]+$/.test(pdf)) return reply(res, 400, { ok: false, error: 'Attachment is not a valid PDF' });
  const replyTo = b.replyTo && EMAIL.test(String(b.replyTo)) ? String(b.replyTo) : undefined;

  const fromName = String(b.fromName || '').replace(/[<>"\r\n]/g, '').slice(0, 80);
  const from = fromName ? `${fromName} <${process.env.MAIL_FROM}>` : process.env.MAIL_FROM;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, reply_to: replyTo, subject, html, text, attachments: [{ filename, content: pdf }] })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return reply(res, 502, { ok: false, error: 'Mail provider said: ' + (j.message || j.error || r.status) });
    return reply(res, 200, { ok: true, id: j.id });
  } catch (e) {
    return reply(res, 502, { ok: false, error: 'Could not reach the mail provider' });
  }
};
