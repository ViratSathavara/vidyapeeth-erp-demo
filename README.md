# NPCTE College ERP — Phase 1 demo

The New Progressive College of Teachers' Education (NPCTE), Mehsana · Karve Trust · B.Ed and M.Ed (4 semesters each).

This is the **clickable Phase 1 demo** built from `docs/NPCTE-ERP-Phase1-Spec.md`: a single page (`index.html`) whose data
lives in the browser (localStorage). It shows every Phase 1 screen and rule to the college before the real
Next.js + Express + PostgreSQL build (spec §1, §13).

Run it: see `RUN-LOCALLY.md` (`npm start`, then http://127.0.0.1:5173).

## What is in it (spec section → screen)
| Spec | Where |
|---|---|
| §2 Roles | Super Admin, Principal, Clerk, Student. Permission matrix in Settings → Roles & permissions; every handler checks the permission, not only the menu. |
| §4 Dashboard | 6 KPI cards, 4 charts (month line, mode donut, course × semester bars, category + cash/scholarship bars), top dues, latest 10 payments, latest notices. Every card and chart opens the filtered list. Clerk sees the fee view. |
| §5 Fee collection | 5 tabs: Collect payment · Expenses · Pending dues · Receipts · Fee setup. 4 modes. Cash / Cheque / Expense invoice date = date entered, editable inline in the table (logged, receipt regenerated). UPI invoice date = payment date + 1 day (Asia/Kolkata), fixed. UPI goes through a `PaymentProvider` adapter; only a verified webhook marks SUCCESS. Cancel with reason, never delete. |
| §6 Students | Add / edit form (personal, course, category, funding type for SC/ST only, 4 editable semester fees + due dates, photo). Auto login + credentials email, forced password change, resend / reset. List with search, filters, sorting, paging, Excel export; CSV import template. Profile with fee cards, receipts, notices, audit trail. |
| §7 Audit | Transactions (every payment + expense, all filters incl. multi-mode, sort on every column, totals per mode, Excel + PDF export). Cash & cheque deposit report (week / month / custom, 4 modes side by side, mark as deposited, undo by Principal). Activity log with before → after, actor, IP / device (Principal + Super Admin). |
| §8 Notices | Audience: all / B.Ed / M.Ed / a semester / selected students / one student. Attachment, schedule, fee-alert and public tags. Fee reminders from Pending dues and the student profile. |
| §9 Student PWA | Manifest, service worker, offline page, install banner (Android prompt / iPhone steps), bottom tabs Home · Fees · Notices · Profile, Pay now (UPI). |
| §10 Notifications | Bell with unread count, inbox (All / Unread / Fees / Notices), live toast + sound + system popup across tabs, missed-notification sync when a tab comes back. |
| §11 Settings | College profile, fees & receipts, roles, staff logins, email sender + outbox, open-item flags, data reset / backup. |

## Demo limits (the real build replaces these)
- Data is per browser; there is no server. "Live" = between tabs of the same browser (the real app uses Socket.IO + Web Push).
- Emails are shown in the outbox (demo mode). The UPI QR is a sample picture, and the gateway is simulated with two webhook buttons.
- The browser PDF uses Helvetica; the server PDF will embed Noto Sans Gujarati.
- Passwords are stored in plain text in the browser. The server uses bcrypt + JWT httpOnly cookies.

## Open items (built with defaults, see Settings → Open items)
expenseReducesDue (off) · funding type for OBC / EWS (off) · semester due dates (11-15 / 04-30 placeholders) and late fee (none) ·
receipt format · bank / UPI gateway · old data import · required reports · student login ID (either works).

## Files
`src/` sources (`npm run build` → `index.html` + CSP in `vercel.json`) · `tests/logic.test.js` (`npm test`, spec §14 rules) ·
`manifest.webmanifest`, `sw.js`, `offline.html`, `icons/` (PWA) · `api/send-receipt.js` (Resend mail function) · `_legacy-demo/` (old Vidyapeeth demo).
