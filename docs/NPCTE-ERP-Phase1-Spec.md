# NPCTE College ERP — Phase 1 Build Spec & Roadmap

> **For the coding agent (Claude Code on Virat's laptop).** This file is the single source of truth for Phase 1.
> Read it fully before writing code. Build only what is written here. Anything marked **OPEN** must be built
> behind a setting/flag with the default stated, and listed in the final report — do not invent business rules.

- **Client:** The New Progressive College of Teachers' Education (NPCTE), Mehsana — run by **Karve Trust**. Courses: **B.Ed** and **M.Ed** (2 years each = **4 semesters**).
- **Current college site:** https://npcte.org (contact on receipts: 02762 220395 · npcte@yahoo.co.in — confirm before go-live).
- **Starting point:** existing demo repo `ViratSathavara/vidyapeeth-erp-demo` (single `index.html`, localStorage, live at vidyapeeth-erp-demo.vercel.app). "Vidyapeeth" was a placeholder name → rename everything to **NPCTE**.
- **Phase 1 scope (only these):** Dashboard · Student Management · Fee Collection (4 payment modes) · Audit Management · Notice Board & Messages · Student Portal (installable PWA) · Live notifications · Roles & Permissions · Settings · Public college website (section 16).
- **Out of scope for Phase 1 — remove from UI:** Attendance, Internal Marks, Practice Teaching, Staff lists, Academic setup beyond course/semester, Parent portal, Bank matching, Day close, Concessions workflow, Promotions. (Keep code history in git; do not ship these screens.)

---

## 1. Architecture decision

The existing demo is browser-only (localStorage). Live notifications (Socket.IO), emailed credentials, real UPI and shared data need a server, so Phase 1 is a **real app in the same repo on a new branch `phase1`**, reusing the demo's look, components and copy wherever possible.

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS, PWA (manifest + service worker) |
| Backend | Node.js + Express + TypeScript (separate `server/` folder) |
| Realtime | Socket.IO (server + `socket.io-client`), rooms per user / role / course / semester |
| Background push | Web Push (VAPID) via service worker — needed because Socket.IO only works while the app is open |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (httpOnly cookie) + bcrypt, role-based guards on every API route |
| Email | Resend (credentials mail, receipt mail) — reuse logic from `api/send-receipt.js` |
| PDF | Server-side receipt PDF with an embedded Unicode font (Noto Sans Gujarati) so Gujarati names print correctly |
| UPI | Payment provider adapter (see §5.4) |
| Hosting | Frontend on Vercel; backend + Socket.IO on a host that supports long-lived WebSockets (Render / Railway / VPS) — **not** Vercel serverless; Postgres on Neon/Supabase/Railway |

Folder layout:

```
/web        Next.js app (all roles, PWA)
/server     Express API + Socket.IO + jobs
/server/prisma/schema.prisma
/docs       this spec, API list, test report
```

---

## 2. Roles & permissions

| Role | Who | Access |
|---|---|---|
| **Super Admin** | Virat (platform owner) | Everything, across colleges. Manages the college record, Principal/Clerk logins, settings, sees all data and the full audit/event log. Built multi-college ready (`collegeId` on every table) even though only NPCTE exists now. |
| **Principal** | College head | **Full access** inside NPCTE: dashboard, students, fees, audit, notices, settings (except platform-level). |
| **Clerk / Accountant** | Handles B.Ed + M.Ed accounts | Students (add/edit), fee collection (all 4 modes, including By Expense), audit reports, notices. Cannot change roles/permissions or college settings. Cannot delete a payment — only cancel with a reason (logged). |
| **Student** | Each enrolled student | Own portal only: profile, own fees & receipts, notices meant for them, notifications. |

- Permissions are stored per role (matrix screen under Settings → Roles & Permissions, editable by Super Admin/Principal) and checked **on the server**, not only by hiding buttons.
- Super Admin can create additional Clerk logins.

### 2.1 Courses and course scope
- **Courses** (B.Ed, M.Ed, and any new one such as PhD) are managed by the Super Admin in Settings → Courses: name, short code (used in enrolment no.), duration in years, number of semesters, default tuition fee per semester, on/off.
- Every Principal / Clerk login is assigned **one or more courses** (Settings → Staff logins → Courses). Examples: one Principal for B.Ed and another for M.Ed; one Clerk for both.
- A login sees and changes **only students, payments, receipts, dues, notices, dashboard figures, audit rows and notifications of its own courses**. Opening another course's student returns 403. The Super Admin sees every course.
- **Course switch in the top bar** (for logins with 2+ courses): *All courses* (default) / B.Ed / M.Ed / … — every screen is filtered to the chosen course. The server applies the same filter on every query (`courseId IN (user's courses)`).
- **Batch** = a course's admission year + duration, e.g. B.Ed `2025-27`. It is a dropdown (8 years back to 1 year ahead), pre-filled from the student and required on every receipt.

---

## 3. Data model (minimum)

```
College(id, name, trustName, address, phone, email, logoUrl, receiptPrefix, settings JSON)
User(id, collegeId, role[SUPER_ADMIN|PRINCIPAL|CLERK|STUDENT], name, email, phone, passwordHash, mustChangePassword, active, lastLoginAt)
Course(id, collegeId, code[BED|MED], name, semesters=4)
FeeTemplate(id, courseId, semester 1..4, defaultAmount)          -- default ₹30,000 per sem (editable in Settings)
Student(id, collegeId, userId, enrolmentNo, name, gender, dob, phone, email, address, photoUrl,
        courseId, admissionYear, currentSemester, category[GENERAL|OBC|SC|ST|EWS],
        fundingType[CASH|SCHOLARSHIP], scholarshipNote?, status[ACTIVE|LEFT|PASSED], createdBy)
StudentSemesterFee(id, studentId, semester 1..4, amount, dueDate?)  -- copied from FeeTemplate, editable per student
Payment(id, collegeId, studentId, semester, batch, mode[CASH|CHEQUE|UPI|EXPENSE], amount,
        invoiceDate, entryAt, chequeNo?, bankName?, chequeDate?, upiRef?, providerTxnId?, expenseReason?,
        status[PENDING|SUCCESS|FAILED|CANCELLED], cancelReason?, receiptNo, receiptPdfUrl, depositId?, createdBy)
Deposit(id, collegeId, type[CASH|CHEQUE], periodFrom, periodTo, total, depositedOn, bankRef, createdBy)
Notice(id, collegeId, title, body, attachmentUrl?, audience{all|course|semester|students[]}, isFeeAlert, publishAt, createdBy)
Notification(id, userId, type, title, body, link, readAt, createdAt)
PushSubscription(id, userId, endpoint, keys)
AuditLog(id, collegeId, actorId, actorRole, action, entity, entityId, before JSON, after JSON, ip, device, at)
```

Money is stored as integer paise. All dates stored in UTC, shown in **Asia/Kolkata**, format DD-MM-YYYY.

---

## 4. Module: Dashboard

Principal & Super Admin see the full dashboard; Clerk sees a fee-focused version.

- **KPI cards:** total students (B.Ed / M.Ed), collected today, collected this month, total outstanding, scholarship students count, fees used as expense this month.
- **Charts** (Recharts or Chart.js, responsive, light/dark):
  - Collection per month (last 12 months) — line
  - Collection by mode (Cash / Cheque / UPI / Expense) — bar or donut
  - Outstanding by course × semester — grouped bar
  - Category split (General / OBC / SC / ST / EWS) and Cash vs Scholarship — bar
- **Lists:** top pending dues (highest outstanding first), latest 10 payments, latest notices.
- Every card/chart click jumps to the filtered list behind it.

## 5. Module: Fee Collection

Keep it to **4 tabs** (replace the demo's 8–9). There is **no separate Expenses section**: an expense is only recorded as a student fee taken **By Expense** (§5.3). **Only tuition fee** is collected (no other fee heads for now).

1. **Collect fee** — every student of the selected course(s), one row each (cards on a phone): name, enrolment no., course · semester, batch, a cell per semester (Paid ✓ / ₹ due / part paid / overdue / upcoming), total paid, due now and a **Collect** button. Filters: search, course, batch, semester, status. Collect opens a panel: pick the semester → **Mode of payment dropdown** (Cash / Cheque / UPI / Expense) → amount, batch dropdown, mode fields → save → receipt.
2. **Pending dues**
3. **Receipts** (all payments, cancel with reason)
4. **Fee setup** (Principal/Super Admin only: default fee per course × semester, receipt prefix, UPI settings)

### 5.1 Fee structure
- B.Ed and M.Ed: 4 semesters each. Fees are tracked **per semester**.
- Settings hold a default per course × semester (initially **₹30,000** each).
- When a student is added, the 4 semester amounts are pre-filled from the default and are **editable for that student** (e.g. ₹25,000 or ₹20,000).
- Outstanding per semester = semester amount − successful payments for that semester (cancelled payments excluded).

### 5.2 Collect payment — 4 modes
Flow: search student (name / enrolment no / phone) → see 4 semester cards with paid/due → pick semester → pick mode → fill fields → save → receipt.

| Mode | Fields | Invoice date rule |
|---|---|---|
| **By Cash** | amount, batch, invoice date, note | **Invoice date = the date the user enters/edits in the table**, not the moment of entry. Default = today, editable. Receipt uses this date. |
| **By Cheque** | amount, batch, cheque no, bank, cheque date, invoice date | Same as Cash: manual invoice date, editable later from the table. |
| **By UPI** | amount, batch (student pays online, or clerk triggers) | **Invoice date = payment date + 1 day** (paid 8 Nov → invoice 9 Nov). Computed automatically in Asia/Kolkata, not editable. |
| **By Expense** | amount, batch, invoice date, what the fee was used for (required) | Same as Cash: manual invoice date, editable later. See §5.3. |

- The invoice date of Cash / Cheque / Expense rows can be edited **inline in the Receipts table**; changing it regenerates the receipt PDF and writes an AuditLog entry with old → new date.
- `entryAt` (real timestamp) is always stored separately for audit.
- **Batch is mandatory on every payment** and typed by the clerk, e.g. `2025-27` (inputs like `2025-2027` or `2025/27` are normalised to `2025-27`; end year must be after start year, max 5 years). Shown on the receipt, PDF, Receipts table, Audit and exports, and searchable. When a student pays UPI from the portal, the batch of their last receipt is used (else admission year + 2).
- After a successful payment: receipt number (prefix + running number), PDF receipt, email to student, in-app + push notification to the student, live update on dashboards via Socket.IO.

### 5.3 By Expense (no separate expense ledger)
- When a student's fee money is used directly for a college expense, the clerk collects that fee with mode **By Expense** in Collect payment.
- Fields: amount, batch, invoice date, **what the fee was used for** (required).
- Effect: it is a normal successful payment: receipt number + PDF + email, the semester due goes down, it can be cancelled with a reason, and the invoice date can be edited.
- It shows as **Expense** in Receipts (mode filter), Audit (mode filter, totals, exports), the deposit report (not deposited to bank) and the Dashboard. It is **not** counted in "Collected" (Cash + Cheque + UPI).
- There is no "Add expense" form, expenses list, expense categories or `expenseReducesDue` setting.

### 5.4 UPI / Google Pay
- Build a `PaymentProvider` interface (`createOrder`, `verifyWebhook`, `getStatus`) so the provider can be swapped.
- Requirement from client: Google Pay / UPI. Google Pay for Business does not openly offer a general collection API; check availability for the college's bank account first. Implement in this order:
  1. **UPI intent / QR** with the college's merchant VPA + payment-gateway webhook (Razorpay / Cashfree / PhonePe PG) — works with Google Pay and any UPI app.
  2. Keep a **Google Pay** adapter stub to switch on if direct access is approved.
- Only the server marks a UPI payment SUCCESS (from the verified webhook), never the browser.
- Student portal: "Pay now" button per due semester.

### 5.5 Pending dues
- List of students with outstanding amount, by course / semester / category / funding type.
- Actions: send fee reminder (to one, selected, or all filtered) → creates a notice + notification.
- Automatic fee alerts: X days before a due date and when overdue (X set in Settings, default 7).

## 6. Module: Student Management

### 6.1 Add / edit student (form)
Sections: Personal (name, gender, DOB, phone, email, address, photo) · Course (B.Ed/M.Ed, admission year, current semester) · Category · Fees.

- **Category:** General / OBC / SC / ST / EWS.
- **Funding type:** By Cash / By Scholarship.
  - When category is **SC or ST**, the funding-type field is shown and must be chosen (By Cash or By Scholarship).
  - For other categories it defaults to By Cash (field hidden; Principal can enable it for all categories in Settings — **OPEN**, default hidden).
  - Funding type is a **filter/label only**. It does **not** change the fee amount or collection process — the student still pays the college; the scholarship comes from the government.
- **Fees:** the 4 semester amounts, pre-filled from defaults, editable.
- Enrolment number auto-generated (e.g. `BED25-001`, `MED25-001`), editable by Principal.

### 6.2 Login creation
- Saving a new student automatically creates the Student user with a strong temporary password.
- An email goes to the student's email with portal link, login ID (enrolment no or email) and temporary password, plus "Install as app" instructions.
- First login forces password change. Clerk/Principal can "Resend credentials" / "Reset password".
- Email delivery status shown on the student profile.

### 6.3 Student list & profile
- Table with search, filters (course, semester, category, funding type, status, has dues) and sorting; export CSV/Excel.
- Profile page: details, 4-semester fee card, all payments & receipts, notices sent, audit trail for that student.

## 7. Module: Audit Management

Two parts:

**A. Transactions audit (main)**
- One table of every payment and expense: date (invoice), entry time, student, course, semester, category, funding type, mode, amount, receipt no, status, entered by.
- **Filters:** mode (Cash / Cheque / UPI / Expense — multi-select), date range, course, semester, category, funding type (Cash/Scholarship), status, entered by, amount range, text search.
- **Sorting** on every column. Totals per mode at the top for the filtered result.
- **Cash & cheque deposit report:** pick a period (week / month / custom) → shows all Cash and Cheque collections not yet deposited, totals, and lets the clerk "Mark as deposited" (date + bank ref) → creates a Deposit record. Report shows all 4 modes side by side for that period so the person taking money to the bank can reconcile.
- Export: Excel + PDF (college header).

**B. Activity log**
- Every action by every role (login, create/edit/cancel, date edits, settings changes, notices sent) with before/after values, actor, IP/device, time. Read-only. Principal and Super Admin only.

## 8. Module: Notice Board & Messages

- Create notice: title, message, optional attachment (PDF/image), audience = **All / B.Ed / M.Ed / a semester / selected students / one student**, optional schedule time, "fee alert" tag.
- Students see notices in their Notice Board, newest first, unread highlighted.
- Fee-related messages to a particular student (e.g. "Semester 2 fee ₹30,000 pending") from the student profile or Pending dues.
- Each notice triggers a live notification (§10).
- WhatsApp/SMS: **not in Phase 1** — keep a `MessageChannel` interface so it can be added later.

## 9. Student Portal (PWA — installable app)

- The student sees **bills only**: receipt no., invoice date, tuition fee, semester, batch, amount and balance. The **mode of payment (Cash / Cheque / UPI / Expense) and office notes are not shown** to the student, in the portal, the PDF or the email.

Same website, installable like the ABCD learning app:
- `manifest.json` (name "NPCTE", icons 192/512, theme colour, `display: standalone`), service worker, offline fallback page.
- After login, show an **"Install as app"** banner/button (Android: `beforeinstallprompt`; iPhone: show the "Share → Add to Home Screen" steps).
- Bottom tab bar on mobile: **Home · Fees · Notices · Profile**.
  - Home: due summary, latest notices, alerts.
  - Fees: 4 semester cards (amount, paid, due, due date), Pay now (UPI), receipts download.
  - Notices: notice board with unread count.
  - Profile: details (read-only except phone/photo if allowed), change password, notification settings.
- Ask for notification permission after install / first login with a clear explanation.

## 10. Live notifications

- **Every event pops up, every time**: when a notification is created for a login that is open, it shows the in-app card (top right) **and** the browser / phone notification (Chrome's own popup), with sound, whether the tab is in front or not. The person who did the action also gets one browser popup confirming it. Popups go through the service worker (`registration.showNotification`, with `vibrate`, `renotify`, a monochrome badge icon) because Android does not allow `new Notification()`.
- Permission is asked after sign-in (once per device). Every profile has **Test popup now / in 10 seconds** and the phone steps for lock-screen popups.
- **Event log** (Audit → Event log, read-only, Principal + Super Admin): every sign-in, failed sign-in, sign-out, page, tab, button click, form save, filter change and error, for every role including Super Admin, with time, person, role, page, course and device. Filters + Excel export. Scoped like the activity log: Super Admin sees all; a Principal sees logins of their own courses.

- **Socket.IO** server with JWT auth on connect; rooms: `user:<id>`, `role:<role>`, `course:<code>`, `sem:<course>-<n>`, `college:<id>`.
- On events (payment success/failed/cancelled, notice published, fee reminder, credentials resent, invoice date changed) the server:
  1. saves a `Notification` row,
  2. emits to the right rooms (live toast + **sound** + bell count update),
  3. sends a **Web Push** to that user's devices so a phone popup appears even when the app is closed.
- Client: toast popup (top-right desktop, top on mobile), short notification sound (respect a mute toggle; play only after first user interaction as browsers require), bell with unread count, inbox with filters (All / Unread / Fees / Notices), mark all read, tap to open the related screen.
- Reconnect handling and missed-notification sync on reconnect (fetch unread since last seen).
- Staff (Principal/Clerk) also get live alerts: new UPI payment, failed payment, payment cancelled, email failed.

## 11. Settings

- College profile (name, trust, logo, address, contact — shown on receipts).
- Default fee per course × semester; due dates per semester; reminder days.
- Receipt prefix & next number.
- UPI provider keys (server-side only, never sent to the browser).
- Email sender settings.
- Roles & Permissions matrix.
- Feature flags for the **OPEN** items.

## 12. Non-functional requirements

- **Responsive & mobile-first:** every screen usable at 360 px; tables turn into cards on phones; no horizontal page scroll; big tap targets.
- **User-friendly:** simple English labels (Gujarati UI toggle = later phase), clear empty states, confirm dialogs for cancel actions, toasts for success/error, light/dark mode.
- **Security:** bcrypt passwords, JWT httpOnly + secure cookies, CSRF protection, rate-limit login, server-side permission checks on every route, input validation (zod), no secrets in frontend, Helmet, CORS locked to the app domain, daily DB backup.
- **Performance:** paginated tables (server-side), indexes on studentId, invoiceDate, mode, collegeId.
- **Accessibility:** keyboard navigation, labels on inputs, focus states, sufficient contrast.
- **Seed data:** 1 Super Admin, 1 Principal, 1 Clerk, ~20 students across B.Ed/M.Ed, mixed categories, payments in all 4 modes, a few notices.

---

## 13. Roadmap (build in this order)

Each phase ends with: working build, tests passing, a short report, and a commit on branch `phase1`.

| # | Phase | Delivers | Done when |
|---|---|---|---|
| 0 | Setup | Branch `phase1`, monorepo `/web` + `/server`, Prisma schema, env example, lint/format, seed script, NPCTE branding | `npm run dev` runs both; seed loads |
| 1 | Auth & roles | Login, JWT, 4 roles, permission matrix, forced password change, role-based layout & menu | Each role sees only its menu; API rejects wrong role |
| 2 | Students | Add/edit form (category + SC/ST funding type), 4 editable semester fees, list/filter/export, profile, auto login + credentials email | New student gets email and can log in |
| 3 | Fee collection | 4 tabs, Cash/Cheque/Expense with manual invoice date + inline edit, receipts PDF + email, pending dues, cancel with reason | Invoice-date rules pass tests; dues correct |
| 4 | UPI | Provider adapter, order + webhook, payment date +1 day invoice rule, Pay now in portal | Sandbox payment marks SUCCESS via webhook only |
| 5 | Audit | Transactions audit with all filters/sorting/totals, deposit report + mark deposited, activity log, exports | Filters & totals match DB queries in tests |
| 6 | Notices & notifications | Notice board, audiences, fee reminders, Socket.IO live toasts + sound + bell, Web Push | Notice reaches the right students live and as phone push |
| 7 | Student PWA | Manifest, service worker, install prompt, bottom tabs, offline page | Installs on Android & iPhone; Lighthouse PWA checks pass |
| 8 | Dashboard | KPIs + 4 charts + drill-down | Numbers match audit totals |
| 9 | Hardening & deploy | Security pass, mobile QA at 360/768/1280, backups, deploy web (Vercel) + server (WebSocket-capable host) + Postgres | Live URL works end to end on a phone |

## 14. Test checklist (must pass)

- [ ] Cash entry made on 10 Nov with invoice date set to 8 Nov → receipt shows 08-11-2026.
- [ ] Editing a cash invoice date in the table regenerates the receipt and logs old → new.
- [ ] UPI paid 8 Nov 23:50 IST → invoice date 09-11-2026; paid 8 Nov 00:10 IST → 09-11-2026.
- [ ] UPI payment never becomes SUCCESS without a verified webhook.
- [ ] New student default fee ₹30,000 × 4; change sem 2 to ₹25,000 → dues reflect it.
- [ ] SC/ST shows the funding-type field; General hides it; scholarship students still show dues.
- [ ] Audit filters (mode + funding type + date range) give correct rows and totals.
- [ ] Deposit report lists only undeposited Cash/Cheque in the period.
- [ ] Clerk cannot open Settings → Roles or the activity log (UI and API).
- [ ] Student can only fetch their own data (try another student's ID → 403).
- [ ] Notice to "B.Ed Sem 1" reaches only those students, live + push, with sound.
- [ ] All screens usable at 360 px width; PWA installs on Android and iPhone.

## 15. Open questions (ask Roshanbhai; build with the defaults above)

1. ~~Expense vs student due~~ — decided: By Expense is a fee payment and reduces the due (§5.3).
2. Should funding type (Cash/Scholarship) be available for OBC/EWS too? (default: SC/ST only)
3. Semester due dates for B.Ed and M.Ed, and late fee — any? (default: no late fee)
4. Receipt format/sample and numbering they use today (photo).
5. College bank account & UPI merchant setup — which bank / gateway is allowed?
6. Old data: Excel import of current students and past payments? (Phase 1: provide a CSV import template for students only)
7. Exact list of reports the trust / university asks for.
8. Login ID for students: enrolment number or email? (default: either)

---

## 16. Public college website (same project)

The current npcte.org is an old WordPress site (2017, run by another vendor). We rebuild it as the public face of the same Next.js app:

- `/` public website · `/login` → ERP (staff + student portal). One domain, one deployment.
- Design reference: `docs/npcte-website-demo.html` (concept demo) — convert its sections into Next.js components with Tailwind; keep colours (navy `#132a5c`, gold `#e0a526`), fonts (Fraunces + Inter) and layout.
- Pages: Home · About (About NPCTE, Principal message, Mission & vision, Management, Infrastructure, Accreditation) · Courses (B.Ed, M.Ed) · Staff profile (B.Ed / M.Ed) · Examination (Schedules, Results) · Notices & News · Downloads (Forms, Old papers) · IQAC · Gallery (photos, video) · Contact.
- **Notices on the website come from the ERP** notice board (a notice can be marked "Public") — no separate CMS needed.
- Admission enquiry form saves to the ERP (new "Enquiries" list for Principal/Clerk) and sends a live notification.
- Simple content editor in the ERP for Principal/Super Admin: pages text, staff list, gallery uploads, downloads (PDF), news.
- SEO: per-page titles/meta, sitemap.xml, robots.txt, `CollegeOrUniversity` schema.org JSON-LD, Open Graph images, fast images (next/image), Lighthouse 90+.
- Content still needed from the college: logo, real photos, staff list, intake per course, management/trustees, infrastructure details, IQAC documents, forms and old papers (the current site's pages for these are empty).
- Roadmap: add as **Phase 10** after deploy (or run in parallel with Phase 8 if time allows).

## 17. Prompt to start the build (paste into Claude Code)

```
Read docs/NPCTE-ERP-Phase1-Spec.md fully. This is the only scope for Phase 1.
Repo: ViratSathavara/vidyapeeth-erp-demo. Create branch `phase1`.
Rename "Vidyapeeth" to "NPCTE" everywhere. Reuse the existing demo's design, colours and components as the UI reference.
Build in the roadmap order of section 13, then the public website in section 16 (design reference: docs/npcte-website-demo.html). After each phase: run tests, fix failures, commit, and give me a short report
(what was built, how to test it, anything OPEN). Do not build out-of-scope modules. Ask me before any choice not covered by the spec.
Use the virat-dev-team skill (Architect → Frontend/Backend → Breaker → QA) for each phase.
```
