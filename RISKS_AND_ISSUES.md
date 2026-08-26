# Risks & Issues — Daily Work Tracker

Findings from a project analysis on 2026-07-15. Not yet actioned — logged for future work.
Ordered by severity. Each item notes the root cause, impact, and suggested fix.

---

## CRITICAL

### 1. Auth model is bypassable — RLS disabled on every table, anon key is public
- **Where:** `supabase_schema.sql`, `supabase_schema_v2.sql`, `supabase_schema_v3.sql` (all `disable row level security`); anon key in `.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- **Impact:** The anon key ships in the browser bundle. With RLS off and default Supabase `anon` grants, anyone can hit `https://<ref>.supabase.co/rest/v1/<table>` directly and read/modify/delete all data, bypassing `proxy.ts` and all per-route checks.
- **Fix:** Enable RLS on all tables with proper policies (or revoke `anon`/`authenticated` grants). Keep service-role usage server-side only.

### 2. Employee passwords stored & compared in plaintext
- **Where:** `supabase_schema.sql` (seed data), `app/api/auth/login/route.ts`, `app/api/employees/route.ts` (POST/PATCH store raw `password`).
- **Impact:** Combined with #1, anyone can dump every employee's plaintext password.
- **Fix:** Hash with bcrypt/argon2; compare hashes on login; migrate existing rows.

### 3. Live secrets exposed / at risk of being committed
- **Where:** `.env.local` holds the service-role key. Outer repo (`D:\XR_Projects\01_Team_Tracking`) shows `app/.env.local`, `app/.next/**`, and a nested `app/.git/**` as untracked with no covering `.gitignore`.
- **Impact:** A `git add .` at the outer repo could commit the service-role key and build artifacts. Leaked service-role key = full DB admin + ability to forge sessions (see #4).
- **Fix:** Rotate keys, add `.gitignore` at both repo levels, resolve the nested `app/.git` repo.
- **Status (2026-08-26):** `.env.local` confirmed git-ignored in the `app/` repo. Gmail App Password rotated after an SMTP auth incident (see Incident log). Service-role key and `SESSION_SECRET` rotation still pending.

---

## HIGH

### 4. Session secret silently falls back to the service-role key
- **Where:** `lib/auth.ts`.
- **Impact:** (a) If `SUPABASE_SERVICE_ROLE_KEY` is unset, every request throws 500 — app down. (b) Rotating the service-role key (required by #3) invalidates all sessions.
- **Fix:** Set a dedicated `SESSION_SECRET` env var.

### 5. Manager login is a hardcoded external dependency
- **Where:** `app/api/auth/login/route.ts` (`MANAGER_USERNAME`, `MANAGER_EMAIL`, `supabase.auth.signInWithPassword`).
- **Impact:** Manager auth depends on a Supabase Auth user existing & confirmed. On a fresh env it locks out the manager. Employees use a DB table — two separate auth systems.
- **Fix:** Unify auth or document/provision the manager Auth user; make manager identity configurable.

### 6. Fresh-env DB setup depends on migrations in exact order
- **Where:** `supabase_schema*.sql` (v3 wipes data, v4 alters `entries`; both assume v1+v2 ran).
- **Impact:** Out-of-order or partial runs break with missing table/column errors. Code already has `absence_note` fallback (`app/api/entries/route.ts`), signaling known drift.
- **Fix:** Consolidate into an idempotent, ordered migration set.

---

## MEDIUM

### 7. Uploaded attachments are world-readable
- **Where:** `supabase_schema_v3.sql` (`public` bucket), `app/api/attachments/route.ts` (`getPublicUrl`).
- **Fix:** Use a private bucket + signed URLs.

### 8. Session persistence UX bug
- **Where:** `app/page.tsx` (uses `sessionStorage`); cookie lasts 7 days but is `httpOnly` so JS can't rehydrate it; no `/api/auth/me` route.
- **Impact:** Users must re-login on every new tab/restart despite a valid cookie.
- **Fix:** Add a session-restore endpoint, or persist appropriately.

### 9. Broadcast probe assumption is fragile
- **Where:** `app/page.tsx` — treats any non-401 from `GET /api/broadcast` as "valid session."
- **Fix:** Use an explicit session-validation endpoint.

### 10. Auto-carry write is unbounded and non-atomic
- **Where:** `app/api/commitments/route.ts` GET — `Promise.all` of individual UPDATEs on a read path, no transaction.
- **Fix:** Move to a bounded/transactional batch update (or a scheduled job).

---

## LOW / Housekeeping
- `entries` id type drift across migrations (uuid → text).
- No rate limiting on login/uploads; weak seeded passwords (e.g. `Work@123`).
- Committed `.next/` cache and nested `.git` bloat the repo.
- Single hardcoded manager; no way to add another without code changes.

---

## Incident log (resolved)

### 2026-08-26 — Weekly summary email failing with `535-5.7.8 BadCredentials`
- **Symptom:** In-app banner "Last send failed: Invalid login: 535-5.7.8 Username and Password not accepted" on the production app.
- **Root cause:** Not a code bug. Gmail rejected the SMTP login — the `GMAIL_APP_PASSWORD` in use (Vercel) was no longer accepted (revoked/invalid/out of sync). `lib/email.ts` config (`smtp.gmail.com:587`, STARTTLS) was correct.
- **Resolution:** Generated a new Gmail App Password ("Daily Task Log"), updated `GMAIL_APP_PASSWORD` in Vercel (Production) and local `.env.local`, redeployed. Send verified working.
- **Follow-up:** Revoke the old App Password now that the new one is confirmed. See README → "Gmail App Password" for the rotation runbook.

---

## Suggested order of action
1. Enable RLS / revoke anon grants (#1).
2. Hash passwords + rotate leaked service-role key + fix `.gitignore` (#2, #3).
3. Set dedicated `SESSION_SECRET` (#4).
4. Consolidate migrations + document manager Auth provisioning (#5, #6).
