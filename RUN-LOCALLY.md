# Run the NPCTE ERP demo on your laptop

Needs Node.js 18 or newer (`node -v`). Nothing to install.

```powershell
cd "D:\01_Projects\Demos\vidyapeeth-erp-demo-local\vidyapeeth-erp-demo"
npm start
```

Open http://127.0.0.1:5173 in Chrome.

| Role | Login | Password |
|---|---|---|
| Super Admin (Virat) | `admin` | `admin123` |
| Principal | `principal` | `principal123` |
| Clerk / Accountant | `clerk` | `clerk123` |
| Student (first sample student) | enrolment no. shown on the login page (e.g. `bed26-001`) or the student's email | `student123` |

New students you add get a temporary password (shown once in the demo) and must change it at first sign-in.

## See live notifications
Open two Chrome tabs on the same address. Sign in as **Clerk** in one and as a **Student** in the other
(each tab keeps its own login). Collect a fee or post a notice in the Clerk tab: the Student tab shows a popup,
plays a sound and updates the bell. If the student tab is in the background and notifications are allowed,
Windows / Android shows a system popup.

## Phone on the same Wi-Fi
`$env:HOST="0.0.0.0"; npm start`, then open `http://<laptop-ip>:5173` on the phone.
(The "Install app" prompt and the service worker need https or localhost, so test installing on the deployed Vercel URL.)

## After changing code
The app is built from `src/` into `index.html`:

```bash
npm run build   # rebuilds index.html and the CSP hash in vercel.json (needs bash: Git Bash or WSL)
npm run check   # verifies index.html and vercel.json agree
```
Never edit `index.html` by hand.

Data lives in this browser (localStorage). Settings → Data → Reset demo data starts over.
The previous Vidyapeeth demo is kept in `_legacy-demo/`.
