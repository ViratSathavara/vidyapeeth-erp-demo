# Real email for the NPCTE ERP demo

The app sends its emails through `api/send-mail.js` (a Vercel function) and Resend.
Without the settings below the app stays in **demo mail mode**: every email is listed with the status
"Sent (demo)" and nothing leaves the browser.

## Vercel environment variables

Vercel → project `vidyapeeth-erp-demo` → Settings → Environment Variables (Production), then redeploy.

| Name | Required | Value |
|---|---|---|
| `RESEND_API_KEY` | yes | API key from resend.com → API Keys (starts with `re_`) |
| `MAIL_FROM` | yes | Sender, e.g. `NPCTE College <noreply@your-domain.com>`. The domain must be verified in Resend → Domains. |
| `MAIL_ACCESS_KEY` | yes | The access key given by the developer. It must match the key inside the demo's encrypted data. |
| `MAIL_REPLY_TO` | no | Where replies go, e.g. `npcte@yahoo.co.in` |
| `MAIL_ALLOWED_DOMAINS` | no | Only allow these recipient domains, e.g. `gmail.com,yahoo.com`. Empty = any. |

Quick test without a domain: `MAIL_FROM=NPCTE College <onboarding@resend.dev>`. Resend then delivers
**only to the email address you signed up to Resend with**, so give the test student that address.

## Which emails are sent

| When | To | Email |
|---|---|---|
| A student is added | student | Welcome, login ID, password, portal link (no popup on screen) |
| Resend credentials / reset password | student | New password |
| A fee is collected (any mode, also UPI) | student | Payment received + receipt PDF (student copy) |
| A receipt is cancelled | student | Receipt cancelled + PDF |
| Fee reminder sent from Pending dues | each selected student | Reminder with the amounts due |
| UPI request sent to the student | student | Payment request with a pay link |
| A staff login is created / its password reset | staff member | Username and password (no popup when email is live) |

Notices are not emailed (in-app and phone notifications only), to stay inside Resend's daily limit.

## Limits

- Resend free plan: 100 emails a day, 3,000 a month. A reminder to many students uses one email each.
- The function allows 40 sends a minute per device and 12 emails an hour to one address.
- The app sends one email at a time; keep the page open until a long reminder batch has gone out.

## Rotating the access key

1. Pick a new random key (32+ characters) and put it in `MAIL_ACCESS_KEY` on Vercel.
2. Rebuild the encrypted data with the same key:
   `NPCTE_DEMO_PASSWORD=... NPCTE_MAIL_KEY=<new key> NPCTE_ALIASES=aliases.json python3 tools/build_vault.py B.ED.xlsx M.ED.xlsx`
3. `npm run build`, commit, push.
