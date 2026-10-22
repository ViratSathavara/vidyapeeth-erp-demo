# Vidyapeeth ERP Demo (B.Ed / M.Ed college management)

A single-page demo (`index.html`) plus one small server function (`api/send-receipt.js`) that e-mails fee receipt PDFs.
All demo data is stored in the visitor's browser (localStorage). No build step.

## Logins
| Role | Username | Password |
|---|---|---|
| Super Admin | admin | admin123 |
| Principal | principal | principal123 |
| Accountant | accountant | account123 |
| Parent (of Riya Joshi) | parent | parent123 |
| Student (Riya Joshi) | student | student123 |

Only these five logins exist at first. The admin adds Clerk and Faculty logins under **Staff and Roles > Edit** (choose the role, type a username and password).

Every student also has a parent login (the enrolment number, e.g. `bed25-001` / `parent123`) and a student login (`stu-bed25-001` / `student123`).

## How receipt e-mail works
1. A payment is recorded (counter, gateway, parent portal or student portal).
2. The app builds a PDF receipt in the browser and puts an entry in **Fee Collection > Email outbox**.
3. **Demo mode** (default): nothing is sent; you can preview the exact email and PDF details.
   **Live mode**: the app posts the PDF to `/api/send-receipt`, which sends it through Resend.

## Turn on live e-mail (5 minutes, works from a phone)
1. Create a free account at https://resend.com. Add and verify your domain (Domains > Add). Create an API key (API Keys > Create).
   - Without a verified domain Resend only lets you send to your own signup address. That is fine for a first test.
2. In Vercel open the project > **Settings > Environment Variables** and add (for Production):
   - `RESEND_API_KEY` = the key from Resend
   - `MAIL_FROM` = for example `accounts@yourcollege.edu` (use `onboarding@resend.dev` while testing)
   - `RECEIPT_API_KEY` = a long random password you invent (at least 24 characters; shorter keys make the function refuse to send)
   - `MAIL_ALLOWED_DOMAINS` = required, the recipient domains you accept, e.g. `gmail.com,yourcollege.edu` (without it the function refuses to send; `MAIL_ALLOW_ANY_DOMAIN=1` overrides, not advised)
   - `ALLOWED_ORIGIN` = your deployed site, e.g. `https://erp.yourcollege.edu` (one origin, no `*`). Leave unset to allow same-site calls only.
   - `RECEIPT_DEMO_MODE` = optional `1` for local/preview tests: needs no key, validates requests, sends nothing. Ignored on production.
3. **Deployments > latest > Redeploy** so the variables take effect.
4. Open the site, sign in as `admin`, go to **Settings > Email receipts**:
   - Sending mode: **Live**
   - Access key: the same `RECEIPT_API_KEY`
   - Test redirect: your own email (so nothing goes to real parents while you demo)
   - Tap **Check mail server**, then **Send a test email**.
5. Take a payment. The PDF arrives in your inbox and the outbox shows **Sent**.

## Notifications (every role)
Every login has a bell at the top with an unread count. Tap it to see the inbox: filter All / Unread / by type, mark all as read, tap one to jump to the right screen.

| Role | Examples of what arrives |
|---|---|
| Super Admin | payments, cancelled receipts, new admissions, concessions to decide, day close, failed receipt emails, bank imports, repeated wrong passwords, permission and fee-rule changes, new logins, overdue-fees and pending-documents summary |
| Principal | concessions to decide, day close and reopen, cancelled receipts, new admissions, promotion, overdue summary, rule changes |
| Accountant | online payments, failed online payments, cancelled receipts, failed receipt emails, bank imports, concession decisions, overdue summary |
| Clerk | families changing their details, pending documents, the decision on a concession they requested, notices |
| Faculty | "attendance not marked" for their class, practice teaching, notices |
| Parent / Student | payment received, failed payment, cancelled receipt, installment due soon or overdue, reminders, absence, marks published, practice teaching, concession decision, promotion, notices for their course |

Rules: the person who does something is never notified about their own action; the people directly concerned (the one who requested a concession, the owner of a changed login) are always told. Super Admin can change who gets what in **Settings > Notification rules** and can send themselves a test. Automatic alerts (due soon, overdue, daily summaries) are created at sign-in and never repeat. The newest 60 per login are kept.
This is an in-app inbox. WhatsApp, SMS and push messages are not sent from this demo (reminders are still written to the Message log).

## Event Log (Super Admin only)
**Event Log** in the menu records every sign-in (and failed sign-in), page opened, button tap, form saved or refused, change, email and script error, for every role, with the person, role, time, device and result. Passwords are never stored. Filter by role, person, type, result, date or any word; open an event for details; see per-person activity on the **People** tab; export CSV; or clear the log (the clearing itself is recorded). The newest 3,000 events are kept in the browser. The older **Audit Log** keeps only business actions (payments, admissions, edits).

## Security notes
- The function refuses every request without the correct `x-api-key` (timing-safe check; if `RECEIPT_API_KEY` is not set it refuses everything), accepts POST only from `ALLOWED_ORIGIN`, validates every field (at most 4 recipients, domain allow-list, no CR/LF in headers, unknown fields such as cc/bcc rejected), accepts only a real PDF up to 1 MB, limits request size, and rate-limits per IP, per key and per recipient.
- Rate limits are kept in memory, so on Vercel each warm instance counts separately and counters reset on cold start. They slow abuse but are not a hard cap. For production use a shared store (Upstash Redis or Vercel KV) or a Vercel Firewall rate-limit rule.
- In this demo the key is typed into the app by the administrator and kept in that browser. For the real product, send the email from the server that records the payment (after the payment gateway confirms it) so the key never reaches a browser, and keep the receipts in a database.
- PDF text uses the built-in Helvetica font, so Gujarati/Hindi names print as `?` in the PDF. The production build should embed a Unicode font (for example Noto Sans Gujarati) on the server.

## Files
- `index.html` the whole app
- `api/send-receipt.js` e-mail function (Vercel Node, no dependencies)
- `vercel.json` headers
- `src/` the readable source parts and the test suite
