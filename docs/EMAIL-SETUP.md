# Real email for the NPCTE ERP demo (Gmail SMTP)

The app sends its emails through `api/send-mail.js` (a Vercel function) over plain SMTP.
No outside email service and no npm package are needed; a Gmail account with an **App Password** is enough.
Without the settings below the app stays in **demo mail mode**: every email is listed with the status
"Sent (demo)" and nothing leaves the browser.

## 1. Make the Gmail App Password

1. Sign in to the Gmail account that should send the emails (e.g. a college office Gmail).
2. Turn on 2-Step Verification: myaccount.google.com → Security → 2-Step Verification.
3. Open myaccount.google.com/apppasswords, type a name (e.g. `NPCTE ERP`) and press Create.
4. Copy the 16-letter password. Spaces do not matter.

## 2. Vercel environment variables

Vercel → project `vidyapeeth-erp-demo` → Settings → Environment Variables (Production), then redeploy.

| Name | Required | Value |
|---|---|---|
| `SMTP_USER` | yes | The full Gmail address, e.g. `npcte.office@gmail.com` |
| `SMTP_PASS` | yes | The 16-letter App Password (not the normal Gmail password) |
| `MAIL_ACCESS_KEY` | yes | The access key given by the developer. It must match the key inside the demo's encrypted data. |
| `MAIL_FROM_NAME` | no | Sender name shown in the inbox. Default `NPCTE College` |
| `MAIL_REPLY_TO` | no | Where replies go, e.g. `npcte@yahoo.co.in` |
| `SMTP_HOST` | no | Default `smtp.gmail.com` |
| `SMTP_PORT` | no | Default `465` (TLS). `587` also works (STARTTLS). |
| `MAIL_FROM` | no | Sender address. Default = `SMTP_USER`. Gmail only allows your own address or a verified alias. |
| `MAIL_ALLOWED_DOMAINS` | no | Only allow these recipient domains, e.g. `gmail.com,yahoo.com`. Empty = any. |

Other providers work the same way (Outlook: `smtp.office365.com` port `587`; Zoho: `smtp.zoho.in` port `465`).

## 3. Check

Open `https://npcte-erp-demo.vercel.app/api/send-mail` — it must show `"configured":true`.
Then unlock the demo, add a student with your own email address and watch the inbox.
If an email fails, the reason is shown in Settings → outbox / the activity log
(e.g. "Login to the mail server failed: check SMTP_USER and the App Password").

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

Notices are not emailed (in-app and phone notifications only), to stay inside Gmail's daily limit.

## Limits

- Gmail: about 500 emails a day (Google Workspace: 2,000). A reminder to many students uses one email each.
- The function allows 40 sends a minute per device and 12 emails an hour to one address.
- The app sends one email at a time; keep the page open until a long reminder batch has gone out.

## Rotating the access key

1. Pick a new random key (32+ characters) and put it in `MAIL_ACCESS_KEY` on Vercel.
2. Rebuild the encrypted data with the same key:
   `NPCTE_DEMO_PASSWORD=... NPCTE_MAIL_KEY=<new key> NPCTE_ALIASES=aliases.json python3 tools/build_vault.py B.ED.xlsx M.ED.xlsx`
3. `npm run build`, commit, push.
