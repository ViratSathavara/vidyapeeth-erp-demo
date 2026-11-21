# NPCTE ERP: change requests (one by one)

Each change gets a number in the order it was asked. Status: Done / In progress / Waiting.
Details of every rule are in `docs/NPCTE-ERP-Phase1-Spec.md` (section given per item).

| # | Date | Change | Spec | Status |
|---|------|--------|------|--------|
| 1 | 21-11-2026 | **Enrolment no. + student password rule.** The office types the enrolment no. when adding a student (required, unique). The password is set automatically: first 5 digits of the mobile + `@` + the year the batch starts (9429086515, batch 2026-28 → `94290@2026`). The student signs in with the enrolment no. **or** the email. Login ID and password are emailed to the student when the student is created. | §6.1, §6.2 | Done |
| 2 | 21-11-2026 | **Admission reference list.** Each reference name is saved once with an id (`REF001`…). Clicking the field lists the saved references to pick from, or adds a new one. Students list can be filtered by reference (and searched by it). | §6.1, §6.3 | Done |
| 4 | 21-11-2026 | **3 modes + cash split + Cash in hand.** "By Expense" is removed: modes are Cash, Cheque, UPI. Under By Cash, part of the fee can be **Expense now** (lines with amount, reason, bill) and part **Cash in hand**; the rest goes to the bank (shown live). The student's fee counts in full. New **Cash in hand** section, one pool per course: expenses (same format) use the oldest student money first, the money left is deposited to the bank in that student's name. Tabs Students / Register (passbook) / Expenses / Bank deposits, exports, prints. Principal cancels an expense or undoes a deposit. Old Expense receipts became Cash with the whole amount as expense. Decisions taken with the defaults ("default ok"). | §5.2, §5.3, §5.6, §7 | Done |
| 3 | 21-11-2026 | **No password change / forgot / reset for students.** A student who forgets the password contacts the office. Only staff with the new permission "Reset student passwords and resend login details" (`students.password`) can reset it (default: Principal yes, Clerk no; tick it in Settings → Roles & permissions). Reset = back to the default rule, or a password the office types; the new one is emailed. | §6.2, §9 | Done |

## Fixed along the way (found while testing change 1-3)
- The `hidden` attribute did not hide fields that have `.field` styling, so **Funding type** showed for every category (the spec says SC / ST only). Fixed with a global `[hidden]{display:none!important}`.
- The hidden photo input took the full width and made the Add / Edit student panel scroll sideways. Fixed.

## Notes
- Demo data already in a browser: students that still had the old demo password `student123` are moved to the rule automatically on the next open. A password the office had already emailed is not touched (Reset password → Default rule moves it).
- A later change of the mobile number or batch does **not** change the password by itself. The student profile shows "Default rule" or "Set by the office"; use Reset password → Default rule to bring it back in line.
