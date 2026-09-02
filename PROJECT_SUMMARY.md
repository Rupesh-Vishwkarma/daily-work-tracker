# Meril Daily Work Tracker – Project Summary

## Project Name
**Meril Daily Work Tracker** (Meril Life Sciences Team Tracking System)

---

## Objectives

### Core Functionality
- **Employee Daily Submissions** – Employees submit daily work updates with tasks, "what changed since yesterday," optional hours, workload levels, blockers, and attachments (screenshots/files/links)
- **Weekly Commitments** – Each member keeps exactly one open **weekly** commitment (a promise the app reminds them about daily until delivered), with Completed / Partial / Carry Forward / Edit / Cancel outcomes and an On-time Delivery reliability metric
- **Manager Dashboard** – Managers review submissions, mark entries as reviewed, add notes/feedback, monitor team progress, and track commitment reliability
- **Project Management** – Create, track, and manage projects; assign team members; set deadlines; monitor progress
- **Blocker Tracking** – Surface and resolve work blockers across the team
- **Broadcast Messaging** – Managers send announcements to all employees
- **Weekly Summary Email** – Automated Sunday email + in-app Weekly Report aggregating each Mon–Sat week
- **Realtime Updates** – Supabase Broadcast nudges refresh employee and manager views without polling
- **Historical Analysis** – View past submissions by date, employee, or project; generate CSV reports
- **Team Management** – Add/remove employees, manage credentials and project assignments

### Design Goals
- Minimal, focused interface (no unnecessary features)
- Apple-inspired design aesthetic (v4 design system)
- Responsive and performant across web devices
- Secure session handling with role-based access control

---

## Challenges Addressed

### Security Vulnerabilities (v5)

#### Critical Issues Fixed
1. **Public API Routes** – All `/api/*` routes were unauthenticated; anyone could read/delete entries, modify employees, or change broadcasts
   - **Solution**: Implemented `proxy.ts` (Next 16 middleware) to enforce authentication and role-based access control on every request

2. **Plaintext Password Exposure** – Passwords retrieved and displayed in the manager Settings table
   - **Solution**: Gated `/api/employees` to manager-only; client never receives password hashes

3. **Forgeable Client-Side Session** – Session stored as plain JSON in `sessionStorage`; users could change `role` in DevTools to grant themselves manager access
   - **Solution**: Server-side signed HMAC-SHA256 session cookie (`httpOnly`) issued on login; verified in proxy on every request

4. **Insecure Manager Login** – `/api/auth/manager-login` accepted *any* Supabase user; hard-coded manager email was in client bundle
   - **Solution**: Consolidated into single login route with hardcoded manager email server-side; removed insecure separate route

5. **Predictable Entry IDs** – IDs generated via `Date.now() + Math.random()`; trivial to enumerate and delete arbitrary entries
   - **Solution**: Replaced with `crypto.randomUUID()`

#### Additional Security Improvements
- No input validation on JSONB payloads; added bounds checking (`project_tasks` capped at 50 items)
- Server-side entry ownership enforcement (employees can only see/edit their own)
- Startup environment validation for required Supabase credentials
- Automatic logout on 401 responses (stale sessions detected and cleared)

---

### Code Hygiene Issues (v5)

1. **Font/Card Constants Duplicated** – `FONT` defined 4 different ways, 2 different values; `CARD` object duplicated in 2 components
   - **Solution**: Unified via `lib/ui.ts`; all components import shared constants

2. **Stale Manager Name** – Settings table showed "Shorya" instead of "Manager"
   - **Solution**: Updated to reflect current manager identity

3. **Hardcoded Default Password** – Default employee password "Work@123" hardcoded in UI; encouraged sharing
   - **Solution**: Cleared field; managers must explicitly set a password per employee

4. **Silent Error Handling** – `BlockersTab.tsx` had empty `catch {}` block
   - **Solution**: Now logs errors to console for debugging

5. **Dead Code** – Two conflicting login flows; separate `manager-login` route never called
   - **Solution**: Removed; consolidated into one

6. **Token Ignored** – `access_token` returned by Supabase but never used
   - **Solution**: Removed; not needed for session-based auth flow

---

### Functional Issues Fixed

#### Entry Management
- **Issue**: "Mark Reviewed" and "Add Note" buttons only visible when entry expanded; inconsistent UX
- **Solution**: Moved to persistent card footer; always available

#### Blocker Visibility
- **Issue**: Blockers tab showing empty; users marked tasks "in_progress" with blocker text, not "blocked" status
- **Solution**: Filter checks both status AND non-empty blocker text

#### Manager Notes Display
- **Issue**: Manager notes/feedback invisible to employees on submissions
- **Solution**: Added ManagerNotes component; renders on submitted entries and in history

#### Deadline Editing
- **Issue**: Manager couldn't set initial deadline (only extend existing)
- **Solution**: Unified "Set/Edit Deadline" button; handles both cases; auto-saves to history

#### Team Member Editing
- **Issue**: No way to change project lead or team members after creation
- **Solution**: Added inline editor in project detail; prevents removal of members who've logged work (with `🔒` indicator)

#### Date Display
- **Issue**: Today's date not shown on employee daily submission form
- **Solution**: Added formatted date below "Today's Work" heading

---

### Performance Optimizations

1. **Supabase Admin Client** – New instance created per function call
   - **Solution**: Module-level singleton with env var guard

2. **ProjectsTab O(N×M) Scans** – 5 separate nested loops per project per render
   - **Solution**: Single `useMemo` computing all stats in one pass

3. **Bulk Data Deletion** – Concurrent DELETE requests fired for every entry
   - **Solution**: Added proper error handling; flagged for future bulk-delete endpoint

---

### Deployment Issues (v5)

1. **Vercel Timeout (ERR_TIMED_OUT)** – Proxy hanging on every request
   - **Root Cause**: `Response.json()` not available in Node.js 18 (Vercel runtime)
   - **Solution**: Replaced with `NextResponse.json()`; added proxy try/catch

2. **Stale Session on Upgrade** – Pre-v5 sessionStorage entries with no server cookie broke login flow
   - **Solution**: On page load, probe `/api/broadcast`; auto-clear stale sessions

---

## Commitments & Accountability (v6 → v7)

The accountability core compares what a member *promised* to what they *delivered*.

- **v6** introduced the commitments loop (a **daily** and a **weekly** promise), progress evidence ("what changed" + attachments), IST / Mon–Sat date logic, and a Meril Academy rebrand. Post-v6 added realtime updates (v6.1) and the automated weekly summary email + Weekly Report (v6.2).
- **v7 (current) — weekly-only commitments.** The daily commitment and its blocking follow-up were removed because a daily promise was too recurring and almost always carried forward. The app now tracks **only a weekly commitment**:
  - **Outcomes:** Completed / Partial / Carry Forward, plus **Edit** and **Cancel** — each of Edit and Cancel **requires a reason** that is recorded on the commitment (edits keep a dated `"<old> -> <new> - <reason>"` audit line).
  - **New `cancelled` status** (`supabase_schema_v6.sql`) that is **excluded from reliability metrics** — a legitimate scope change is not a broken promise.
  - **Deferred writes:** every commitment action is **staged locally** and only written when the employee **submits that day's log**; leaving without submitting discards the change. Cancelling forces a replacement weekly before submit.
  - **No data loss:** existing daily-commitment rows (`horizon = 'day'`) are preserved for the record; the app simply stops creating and following up on them.
  - Rolled out in tagged restore points: `TeamTrackingV1` (pre-removal), `TeamTrackingV2` (remove daily), `TeamTrackingV2.1` (edit/cancel), `TeamTrackingV2.2` (deferred-on-submit).

---

## Technical Stack

- **Framework**: Next.js 16 (App Router, Turbopack), React 19, TypeScript 5
- **Database**: Supabase PostgreSQL (+ Auth, Storage, Realtime Broadcast)
- **Authentication**: Signed HMAC-SHA256 session cookies (httpOnly, 7-day)
- **Email**: Gmail SMTP via nodemailer (weekly team summary)
- **Deployment**: Vercel (auto-deploy from `main`; weekly cron for the summary)
- **Design**: Meril Academy design system (navy/gold, Manrope; inline styles)
- **Branding**: Meril Life Sciences logo and color scheme; tab title "Immersive Team"

---

## Version History

| Version | Date | Focus |
|---------|------|-------|
| v1-v3 | Pre-2026 | Initial development & iteration |
| v4 | 2026-06-26 | Full design overhaul; v4 design system; bug fixes |
| v4.1 | 2026-06-26 | Reorder History tab views (Calendar first) |
| v5 | 2026-06-26 | Security hardening; auth proxy; code hygiene |
| v6 | 2026-07-04 | Commitments loop, "what changed" + attachments, IST/Mon–Sat, Meril Academy rebrand |
| v6.1 | 2026-07 | Realtime live updates; logo/favicon polish |
| v6.2 | 2026-07-18 | Automated weekly summary email + Weekly Report; self-service absence; CSV export |
| v7.0 | 2026-09 | **Weekly-only commitments** — remove daily commitment; Edit/Cancel with required reason; `cancelled` status; commitment actions deferred to daily-log submit |

---

## Key Decisions

1. **Session Cookies Over JWT** – Signed cookies allow server-side revocation and rotation without client involvement
2. **No Password Hashing** – Passwords remain plaintext but access is manager-gated; revisit if Settings feature is deprecated
3. **Proxy Over Route Guards** – Centralized auth enforcement at network boundary prevents accidental bypasses in individual handlers
4. **Inline Styles Over CSS** – Matches Next.js App Router convention; simplifies deployment and reduces bundle size

---

## Known Limitations & Future Work

- No rate limiting on auth endpoints (add before public launch)
- No bulk-delete API (currently fires N concurrent DELETEs)
- Only the weekly summary email is automated; daily reminder / daily manager digest emails still deferred
- No audit logging of general mutations for compliance (commitment Edit/Cancel reasons are the exception — they are recorded on the row)
- RLS disabled on all tables; security depends on the auth proxy + service-role key
- Passwords stored plaintext (no longer displayed); hashing pending
- Manager identity/email hardcoded in the login route
- No password reset flow (manager must use Supabase console)

For the full, severity-ordered backlog see [`RISKS_AND_ISSUES.md`](./RISKS_AND_ISSUES.md); for the complete product blueprint see [`PRD.md`](./PRD.md).

---

*Last Updated: 2026-09-02 | Version: 7.0.0 (weekly-only commitments)*
