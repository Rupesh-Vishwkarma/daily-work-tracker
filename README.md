# Meril Daily Work Tracker

Internal web app for a Meril Life Sciences engineering/XR team to log daily work
updates, make and follow up on commitments, and give a single manager a real-time
view of progress, blockers, and reliability. See [`PRD.md`](./PRD.md) for the full
product blueprint and [`RISKS_AND_ISSUES.md`](./RISKS_AND_ISSUES.md) for the
tracked security/tech-debt backlog.

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime Broadcast)
- **Email:** Gmail SMTP via nodemailer (weekly team summary)
- **Hosting:** Vercel (auto-deploy from `main`) — https://dailytasklog.vercel.app

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on the login
screen (session gate routes to the Login / Employee / Manager view).

Other scripts:

```bash
npm run build   # production build (also the deploy gate)
npm start       # serve the production build
npm run lint    # eslint
npm test        # vitest unit tests
```

## Environment variables

Create `app/.env.local` (git-ignored — never commit it). Required:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side data access (secret) |
| `SESSION_SECRET` | HMAC key for signed session cookies. Falls back to the service-role key if unset — set it explicitly in production |
| `GMAIL_USER` | Gmail address that sends the weekly summary (e.g. `ai.merillife@gmail.com`) |
| `GMAIL_APP_PASSWORD` | Gmail **App Password** (16 chars, no spaces) for SMTP |
| `GEMINI_API_KEY` | Optional — AI narrative boundary (not wired into the live send flow) |
| `CRON_SECRET` | Bearer token that authorizes `/api/cron/weekly-summary` |
| `APP_URL` | Public app URL, used in email links |
| `WEEKLY_TO` / `WEEKLY_CC` | Optional overrides for weekly-summary recipients |

The same variables must be configured in **Vercel → Project → Settings →
Environment Variables** (scoped to **Production**) for the deployed app. A change
to any variable only takes effect after a **redeploy**.

### Gmail App Password (email sending)

The weekly summary sends over `smtp.gmail.com:587` (STARTTLS) using an App
Password — not the account's normal password. If sending fails with
`535-5.7.8 Username and Password not accepted`, the credential is invalid,
revoked, or out of sync with Vercel. To rotate it:

1. On the sending Google account, enable **2-Step Verification**
   (App Passwords require it): https://myaccount.google.com/signinoptions/two-step-verification
2. Create a new App Password at https://myaccount.google.com/apppasswords
   (name it e.g. `Daily Task Log`). Google shows it as four groups of four —
   **remove the spaces** when copying.
3. Set `GMAIL_APP_PASSWORD` to the new value in Vercel (Production) and in local
   `.env.local`.
4. **Redeploy** on Vercel so the new value is picked up.
5. Once a real send succeeds, revoke the old App Password.

## Deployment

Vercel auto-deploys from `main`. The weekly summary runs via Vercel Cron
(`vercel.json` → `/api/cron/weekly-summary`, Sundays), authorized by
`CRON_SECRET`.
