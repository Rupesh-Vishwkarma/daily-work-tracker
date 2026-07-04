# Meril Daily Work Tracker – Project Summary

## Project Name
**Meril Daily Work Tracker** (Meril Life Sciences Team Tracking System)

---

## Objectives

### Core Functionality
- **Employee Daily Submissions** – Employees submit daily work updates with tasks, time allocation, workload levels, and blockers
- **Manager Dashboard** – Managers review submissions, mark entries as reviewed, add notes/feedback, and monitor team progress
- **Project Management** – Create, track, and manage projects; assign team members; set deadlines; monitor progress
- **Blocker Tracking** – Surface and resolve work blockers across the team
- **Broadcast Messaging** – Managers send announcements to all employees
- **Historical Analysis** – View past submissions by date, employee, or project; generate reports
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

## Technical Stack

- **Framework**: Next.js 16.2.9 (App Router) with TypeScript
- **Database**: Supabase PostgreSQL
- **Authentication**: Signed HMAC-SHA256 session cookies (httpOnly, 7-day)
- **Deployment**: Vercel (auto-deploy from GitHub)
- **Design**: Apple v4 design system (SF Pro fonts, inline styles, no CSS classes)
- **Branding**: Meril Life Sciences logo and color scheme

---

## Version History

| Version | Date | Focus |
|---------|------|-------|
| v1-v3 | Pre-2026 | Initial development & iteration |
| v4 | 2026-06-26 | Full design overhaul; v4 design system; bug fixes |
| v4.1 | 2026-06-26 | Reorder History tab views (Calendar first) |
| v5 | 2026-06-26 | Security hardening; auth proxy; code hygiene |

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
- No email notifications (could be added via Supabase functions)
- No audit logging (could track mutations for compliance)
- Manager passwords only in Supabase Auth (consider sync mechanism)
- No password reset flow (manager must use Supabase console)

---

*Last Updated: 2026-06-26 | Version: 5.0.0*
