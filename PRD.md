# Product Requirements Document & Blueprint — Meril Daily Work Tracker

| Field | Value |
|-------|-------|
| Product | Meril Daily Work Tracker (Team Tracking System) |
| Owner | Rupesh Vishwkarma |
| Current version | 6.0.0 (`v6`, commit `3997f19`) |
| Repository | github.com/Rupesh-Vishwkarma/daily-work-tracker |
| Hosting | Vercel (auto-deploy from `main`) |
| Backend | Supabase (PostgreSQL + Supabase Auth + Storage) |
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5 |
| Timezone | IST (UTC+5:30); working week Monday–Saturday |
| Status | Live, internal team use |
| Document purpose | **Complete blueprint** — the as-built product end to end, the full change history, and the forward roadmap |

---

## 0. How to read this document

This is the single source of truth for the project. It has three layers:

1. **As-built (§1–§9)** — exactly what exists and runs today at `v6`.
2. **Change history (§10)** — every commit, change, and fix from first commit to `v6`, so anyone can reconstruct how the product got here.
3. **Forward roadmap (§11–§16)** — what's deferred and planned (email automation, Zoho, enterprise hardening), plus success metrics and open questions.

---

## 1. Overview

The Daily Work Tracker is an internal web app for a Meril Life Sciences engineering/XR team (~10 members, one manager). Employees log a daily work update — tasks with project, status, optional hours, "what changed since yesterday," blockers, and attachments — and make **commitments** (a daily and a weekly promise) that the app follows up on the next working day. A single manager reviews submissions, tracks projects and deadlines, surfaces blockers, monitors commitment reliability, broadcasts announcements, and manages the team roster.

It began as a static HTML prototype (`daily_work_tracker.html`, `index-v4.html` at the repo root — legacy) and was rebuilt as a Next.js app in `app/`, backed by Supabase. `v6` added the commitments accountability loop, progress evidence (attachments + what-changed), IST/Mon–Sat date logic, and a full rebrand to the Meril Academy design system.

### Vision
A fast, low-friction daily standup replacement that gives one manager a clear, real-time picture of what the team is doing, where progress is being made, and what's blocked — grounded in **output and accountability**, not hours or surveillance.

### Operating philosophy (drives every design decision)
- **Output over hours.** Whether a task took 4h or 8h is irrelevant; completion and visible progress are the real signals. Hours are kept but optional and de-emphasized.
- **Deadlines are commitments, not suggestions.** Keep deadlines stable; make any change explicit and accountable; alert early when at risk instead of quietly extending.
- **No idle time, framed as "unblock people."** Every member should be meaningfully engaged and progressing. Surface who is blocked/stalled — not to "catch idlers," but to remove blockers.

---

## 2. Problem statement

- Managers lack a consolidated, daily view of who did what, how loaded people are, and what's blocking progress.
- Verbal/standup or chat updates aren't searchable, aren't tied to projects, and produce no history or metrics.
- Nothing holds a member accountable to what they *said* they'd do — there's no promise/follow-up loop.
- Existing PM tools (Jira, etc.) are too heavy for a small team's daily check-in.

---

## 3. Personas & roles

| Role | Count | Capabilities |
|------|-------|--------------|
| Manager | 1 (fixed account) | Full read of all entries; review + note; manage projects, deadlines, teams; add/remove employees and **reset** passwords; broadcast; submit on behalf / mark absent; view commitment reliability & blockers; CSV export |
| Employee | N (~10) | Submit/edit own daily update (editable until end of day IST); follow up on and make commitments; attach evidence; view own history, stats & reliability; see manager notes & broadcasts |

The manager is a single hardcoded identity in `app/api/auth/login/route.ts`: login username **`Shorya`** (case-insensitive), authenticated against a fixed Supabase Auth account (`ai.merillife@gmail.com`), with a stable internal `id: 'manager'`. Employees are rows in an `employees` table. Passwords are stored in the `employees` table and are **never returned to the client** — the manager resets them, they are not displayed.

---

## 4. As-built architecture (v6)

### 4.1 Tech stack
- **Framework:** Next.js 16.2.9 (App Router, Turbopack), React 19.2.4, TypeScript 5.
- **Styling:** Inline styles + a shared `lib/ui.ts` (`FONT`, `BRAND`, `CARD`, `fmtDate`) and some global CSS in `globals.css`. Meril Academy design system — navy `#33398a`, navy-dark `#282d6e`, purple `#4b3e9d`, gold `#fdc814`, on `#f6f7fb`; **Manrope** typeface (loaded via `<link>` in `layout.tsx`). Tailwind v4 is a dependency but the UI is predominantly inline styles.
- **DB/Auth/Storage:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`). Anon client for manager auth; service-role admin client (lazy singleton) for all data access. Storage bucket `attachments` (public) for screenshots/files.
- **Auth/session:** Custom signed session token (HMAC-SHA256 via Web Crypto in `lib/auth.ts`), stored in an `httpOnly` cookie `dwt_auth`, 7-day expiry, `sameSite=lax`, `secure` in production. Session summary mirrored in `sessionStorage` for client rendering.
- **Access control:** `proxy.ts` — the Next 16 middleware (renamed convention; exports `proxy` + `config.matcher = '/api/:path*'`). Verifies the session on every API request, enforces manager-only method/route rules, and injects `x-user-id`, `x-user-role`, `x-user-name` headers downstream. Confirmed active in the build output as `ƒ Proxy (Middleware)`.
- **Dates:** `lib/dates.ts` — all product dates run on **IST (UTC+5:30)** with a **Mon–Sat working week** (only Sunday is non-working). Provides `todayIST`, `isWorkingDay`, `nextWorkingDay`, `prevWorkingDay`, `workingDaysBetween`, `weekMonday`, `weekSaturday`.

### 4.2 App structure
```
app/
  app/
    layout.tsx        (loads Manrope; metadata)
    page.tsx          (client; session gate → Login/Employee/Manager)
    globals.css       (brand CSS variables, buttons, chips, alerts)
    icon.svg, favicon
    api/
      auth/login, auth/logout
      entries, commitments, attachments
      projects, employees, comments, broadcast,
      reviewed, resolved-blockers
  components/
    LoginPage.tsx, EmployeePage.tsx, ManagerPage.tsx
    manager/ TodayTab, CommitmentsTab, BlockersTab,
             ProjectsTab, HistoryTab, SettingsTab, EntryRow
  lib/ auth.ts, dates.ts, supabase.ts, types.ts, ui.ts, upload.ts
  proxy.ts
  scripts/ seed-test-data.mjs, clear-test-data.mjs
  supabase_schema.sql, supabase_schema_v2.sql, supabase_schema_v3.sql
```

### 4.3 Data model (Supabase)

Applied in order: `supabase_schema.sql` (v1) → `supabase_schema_v2.sql` → `supabase_schema_v3.sql`. RLS is disabled on all tables; the service-role key + `proxy.ts` are the only access gate.

| Table | Key fields | Notes |
|-------|-----------|-------|
| `employees` | id, username, name, password, role, created_at | id = lowercase username; password never sent to client |
| `entries` | id, employee_id, employee_name, date, workload, timestamp, submit_count, is_absent, submitted_by_manager, project_tasks (jsonb) | One per employee per day (by convention); `project_tasks` capped at 50; `submit_count` increments on each edit |
| `commitments` | id, employee_id, employee_name, project_id, horizon, text, due_date, created_in_entry_id, status, outcome_note, resolved_at, carry_count, created_at | The promise→follow-up→delivered loop (§6) |
| `projects` | id, name, color, lead, members (jsonb), start_date, deadline, end_date, status, previous_deadlines (jsonb), created_at | status: active/closed |
| `comments` | id, entry_id, text, author, timestamp | Manager notes on an entry |
| `reviewed_entries` | entry_id, reviewed_at | Manager "reviewed" flag |
| `resolved_blockers` | key (`entryId:taskIndex`), resolved_at | Blocker resolution state |
| `broadcast` | id (=1), message, active, updated_at | Single-row announcement |
| Storage `attachments` | public bucket | Screenshots/files; path `{userId}/{timestamp}-{safeName}` |

**`project_tasks` item shape** (jsonb): `{ project_id, task, time, status, blockers, what_changed?, attachments? }` where `status ∈ in_progress | completed | blocked` and each attachment is `{ type: 'image' | 'file' | 'link', url, name }`.

**`commitments` enums:** `horizon ∈ day | week`; `status ∈ open | done | partial | missed`. `project_id` may be a real id, `'__other__'` (Other Work), or null.

### 4.4 API surface

All routes sit behind `proxy.ts`. "any (scoped)" = authenticated; employees are server-scoped to their own rows via `x-user-id` regardless of query params.

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/auth/login` | POST | public | Manager (Supabase Auth) or employee (table) login; sets signed cookie |
| `/api/auth/logout` | POST | any | Clear cookie |
| `/api/entries` | GET/POST/PATCH/DELETE | GET/POST/PATCH any (scoped); DELETE manager | Entries CRUD; employees scoped to own; **edit-until-EOD** lock; commitment gate on POST |
| `/api/commitments` | GET/POST/PATCH/DELETE | GET/POST/PATCH any (scoped); DELETE manager | Commitments loop; daily-only auto-carry on GET; resolve (done) / horizon-aware carry on PATCH |
| `/api/attachments` | POST | any (scoped) | Upload screenshot/file to Storage (≤2 MB, allowlisted types); returns public URL |
| `/api/projects` | GET any; POST/PATCH/DELETE manager | Projects CRUD |
| `/api/employees` | all manager | Roster + password management; GET **excludes** password column |
| `/api/comments` | GET any; POST/DELETE manager | Manager notes |
| `/api/reviewed` | all manager | Reviewed flags |
| `/api/resolved-blockers` | all manager | Blocker resolution |
| `/api/broadcast` | GET any; PUT manager | Announcement |

---

## 5. Functional requirements — Authentication & session

- **FR-A1:** Single login form. Username `Shorya` (case-insensitive) routes to Supabase Auth (fixed email); all others to the `employees` table (username lowercased, password compared).
- **FR-A2:** On success, a signed HMAC session cookie (`dwt_auth`, 7-day) is set; role drives which UI renders.
- **FR-A3:** On app load, a session in `sessionStorage` is validated by probing `/api/broadcast`; a 401 clears it and returns to login.
- **FR-A4:** Logout clears the cookie server-side and the `sessionStorage` mirror.
- **FR-A5:** `SESSION_SECRET` is used to sign tokens; it falls back to `SUPABASE_SERVICE_ROLE_KEY` if unset (should be set explicitly in production).

---

## 6. Functional requirements — Commitments loop (the accountability core)

Accountability comes from comparing what a member *promised* to what they *delivered*. The employee's daily flow is three steps.

**Step 1 — Follow up (daily).** The app surfaces open **daily** commitments due today or earlier. The employee marks each **Completed / Partial / Carry Forward**, with an optional outcome note. **Completed** closes the commitment; **Partial** (some progress) and **Carry Forward** (none) both keep it open and roll it to the next working day. There is **no "Missed"** outcome. Submitting the day's update is **blocked** (client + server) until due **daily** commitments are resolved. If a daily task is Partial/Carry Forward, the carried copy becomes the next day's goal, so **a new daily commitment is optional** that day.

**Step 2 — Log.** Enter today's work as task rows (§7.1).

**Step 3 — Commit.** Daily: at least one **daily** commitment ("what will you accomplish by the next working day?"), each linked to a project or tagged Other Work — unless one is already carried to the next day (then optional). Weekly: the rule is **always have exactly one open weekly commitment**. A new weekly (due that week's Saturday) is **mandatory when none is open** — the first login of the week, or right after completing one mid-week — and **non-mandatory while a carried weekly is still open**. It is **skipped** if the first login of the week is Saturday with nothing open. Each commitment's exact due date is shown (a "Due «Weekday, DD Mon»" pill).

**Weekly carry & persistent reminder.** On Saturday the weekly is resolved **Completed / Partial / Carry Forward**. Partial/Carry Forward roll it to **next week's Saturday** and keep it open. A carried/open weekly is shown **every day as a non-blocking reminder** (it never blocks the daily update) and can be marked Completed on any day. When completed mid-week, a new weekly for the current week's Saturday becomes mandatory again; once Completed it disappears.

**Rules & signals:**
- The week runs **Sun–Sat** with **Mon–Sat working days** (Sunday is non-working; employees do not submit on Sunday). Follow-up is weekend-aware (`nextWorkingDay` skips Sunday), so Saturday's daily promise is followed up Monday.
- **Weekly summary (planned):** each week's Mon–Sat work is aggregated into a single combined team summary sent to the manager the following Sunday (see §13, Phase 3).
- **Auto-carry (daily only):** on GET, open **daily** commitments past their due date roll forward to today, with `carry_count` incremented by the number of working days missed (so ignoring a promise for 3 days shows "carried ×3"). Weekly commitments are **not** auto-carried — they stay open as a persistent reminder and roll only via explicit Carry Forward.
- **On-time Delivery %** = completed **without ever carrying** (`carry_count === 0`) ÷ total completed, per employee per period — the headline metric shown to both manager (Commitments tab) and employee (My Stats). Open/carried commitments are excluded until completed.
- A commitment **carried 3+ times** is escalated on the manager's Commitments tab as **stalled work**.
- **Server enforcement:** POST `/api/commitments` validates required fields, horizon, and scopes `employee_id` to the caller; PATCH enforces ownership and valid action/status; DELETE is manager-only.

---

## 7. Functional requirements — Employee

### 7.1 Daily update (task rows)
- **FR-E1:** Add N task rows. Each row: project picker (My Projects / Other Projects / Other Work), task title, **optional** hours, status (In progress / Completed / Blocked), optional blocker text, **required "what changed since yesterday,"** and optional attachments.
- **FR-E2:** Status indicator circle per task: in-progress = navy ring, completed = solid green ✓, blocked = solid red !.
- **FR-E3:** Attachments per task — **screenshot/image** and **file** upload (client-compressed, ≤2 MB, allowlisted types) and **inline link** entry. Attachments open in a single new tab.
- **FR-E4:** Overall workload selector (light / medium / heavy).
- **FR-E5:** Submit validation: ≥1 task with a title; "what changed" filled for every task; due daily commitments resolved; ≥1 daily commitment (unless one is already carried to the next day); weekly commitment whenever no open weekly exists (and not a Saturday first-login).

### 7.2 Edit & lock
- **FR-E6:** One update per day; **editable until end of the IST day, then locked** (server rejects edits when `entry.date !== todayIST()`).
- **FR-E7:** Each edit **increments `submit_count`**; the manager sees an "· edited" tag when `submit_count > 1`.
- **FR-E8:** **Absent-day recovery** — if the manager marked the employee absent, the dashboard shows an amber "Marked absent today" card with an "I worked today — log my update" button. Logging real work clears `is_absent`, so it counts as a submission.
- **FR-E9:** Editing does **not** re-create commitments (no duplicates).

### 7.3 Views
- **FR-E10:** Submitted-state confirmation card; today's tasks; manager notes on entries; open commitments list.
- **FR-E11:** "My Stats" — On-time Delivery %, total updates, completion rate, hours logged, commitment outcomes (Completed / On-time / In progress), workload distribution, task outcomes, project breakdown (30-day window).
- **FR-E12:** Recent history (last 5 non-today entries) with manager notes; absent days shown explicitly.
- **FR-E13:** Active broadcast banner (dismissible).

---

## 8. Functional requirements — Manager

### 8.1 Today
- **FR-M1:** Stat cards (Submitted, Pending, Heavy, Medium, Light) that act as filters.
- **FR-M2:** "Yet to Submit" list with per-employee **Absent** and **Submit on behalf** actions (modal).
- **FR-M3:** Expand an entry to view tasks, what-changed, attachments, blockers; **mark reviewed / unmark**; **add manager note**.
- **FR-M4:** Delete an entry; entries show an "· edited" tag when revised.
- **FR-M5:** Manager can log their own daily update.
- **FR-M6:** Filter by employee name.

### 8.2 Commitments
- **FR-C1:** Team stat cards — On-time Delivery %, Commitments Made, Completed, Due/Overdue, Stalled (3+ carries).
- **FR-C2:** Stalled-work escalation list (committed ≥3 times without delivery).
- **FR-C3:** Per-member reliability, promised/delivered/open counts, expandable commitment history with outcome notes; period selector (7/30/90 days).

### 8.3 Blockers
- **FR-B1:** List all tasks in the last 30 days that are `blocked` OR have non-empty blocker text.
- **FR-B2:** Age indicator (Today / Yesterday / Nd ago) with color escalation.
- **FR-B3:** Resolve/reopen a blocker (persisted by `entryId:taskIndex`).
- **FR-B4:** Show/hide resolved.

### 8.4 Projects
- **FR-P1:** Create project (name→slug id, lead, members, start, deadline, color).
- **FR-P2:** Per-project stats: today count, total submissions, last activity, total hours, per-member contributions.
- **FR-P3:** Deadline alerts (overdue, due within 7 days).
- **FR-P4:** Edit deadline (set or extend; keeps `previous_deadlines` history).
- **FR-P5:** Inline rename; mark complete (archive with end_date); delete.
- **FR-P6:** Edit team & lead; members who have logged work are locked from removal (🔒).
- **FR-P7:** Completed projects section with on-time / missed-deadline badges and contribution bars.

### 8.5 History
- **FR-H1:** Calendar view (default) — workload dots per day, per-date submissions, missing-employee count.
- **FR-H2:** Weekly dashboard — per-employee week nav, day-by-day hours (Mon–Sat working days), project time, completion rate, CSV.
- **FR-H3:** People dashboard — per-employee reliability (submitted ÷ **Mon–Sat** working days %), output, workload mix, project table, period selector (week/month/3m/all).
- **FR-H4:** List view — grouped by date, employee filter, CSV export, per-employee workload stat cards.
- **FR-H5:** Date range with 7/30/90-day quick presets (list view).

### 8.6 Settings
- **FR-S1:** Broadcast editor (message + active toggle).
- **FR-S2:** Team member table (no passwords shown); **reset password** inline; remove member (entries kept).
- **FR-S3:** Add employee (name, username, password).

---

## 9. Security model (as-built)

- Server-side signed session cookie (`httpOnly`, HMAC-SHA256); role cannot be forged client-side.
- Central enforcement in `proxy.ts`; manager-only routes/methods gated there and re-checked in handlers for ownership.
- Employees can only read/write their own entries and commitments (server-scoped by `x-user-id`).
- Entry and commitment IDs are UUIDs (non-enumerable).
- Passwords are **never returned** by `/api/employees` GET; the manager resets them (no plaintext display).
- Attachment uploads are size-limited (≤2 MB) and type-allowlisted; stored under a per-user path.
- JSONB payload bounds (`project_tasks` ≤ 50; commitments batch ≤ 20).
- Startup env validation for Supabase creds.

### Known security gaps (tracked for hardening)
- Employee passwords are stored in **plaintext** in the DB (no longer displayed, but not hashed).
- No rate limiting on `/api/auth/login` (brute-force exposure).
- No CSRF token (relies on `sameSite=lax`).
- RLS disabled — all DB security depends on the proxy + service-role key.
- `SESSION_SECRET` falls back to the service-role key if unset.
- No audit log of mutations yet.

---

## 10. Complete change history (first commit → v6)

Chronological. Tags: `v1.0.0`, `v2.0.0`, `v4.0.0`, `v4.1`, `v5`, `v6`.

### Genesis — Next.js + Supabase (2026-06-18)
- `667c148` **Add Next.js app with Supabase integration** — initial rebuild of the static HTML tracker into a Next.js App Router app backed by Supabase (v1 schema: `employees`, `entries` with free-text `work`/`blockers`).
- `2e1ba61` Fix manager login to use the correct Supabase email.
- `39a9793` Add try/catch to all fetch calls to prevent a stuck loading state.

### v2 — task model + projects + Apple/iOS redesign (2026-06-21)
- `91448f9` **v2 — task-based entries, projects, blockers, Apple/iOS redesign** — replaced free-text work with structured `project_tasks` (jsonb), added `projects`, `comments`, `reviewed_entries`, `resolved_blockers`, `broadcast` tables (`supabase_schema_v2.sql`).
- `c48f86b` Skip ESLint during Vercel build (strict react-hooks rules blocked deploy).
- `b220733` Revert: restore `next.config.ts` (eslint option not valid in Next.js 16).

### v4 — design system + manager UI (2026-06-22 → 06-25)
- `a423dcc` **v4 design — login page, task form, colors.**
- `1b1445a` **v4 manager UI — EntryRow, TodayTab, Blockers, History, Projects.**
- `25b7ae3` / `6cb3e19` / `d45a618` / `6927ec2` Manager identity fixes — display name and login username normalized to `Manager`; use hardcoded manager email for Supabase Auth.
- `32997b6` Show "Mark Reviewed" and "Add Note" on all entries without expanding.
- `c775df1` Show blockers with non-empty blocker text regardless of task status.
- `fe90926` Apply all 8 code-review findings + cleanup.

### v4.1 — project management depth (2026-06-25)
- `6d3cbb9` Delete-project button (active + completed cards).
- `69fcf5c` Inline project rename.
- `575dc62` Allow Manager to be a project lead/member.
- `9027184` Edit deadline and team members on existing projects.
- `81239cd` Swap Calendar/List positions in History; default to Calendar.

### v5 — security hardening + branding (2026-06-25)
- `caf60a4` Show manager notes on employees' submitted entries.
- `d56b82c` Show today's date below "Today's Work" heading.
- `e38e17f` **v5 — security hardening + code hygiene** (signed session cookie, `proxy.ts` enforcement, scoping).
- `499c355` **Meril branding** — logo in navbar/login, favicon.
- `abdf23b` Fix Vercel timeout — `NextResponse.json`, proxy try/catch, session-cookie probe.
- `77be45c` Remove manager username instructions from LoginPage.

### v6 — commitments, evidence, IST/Mon–Sat, rebrand (2026-07-04 → 07-05)
- `047d816` **v6.0 — commitments loop, "what changed" field, attachments, IST dates, EOD edit lock, manager Commitments tab.** Added `supabase_schema_v3.sql` (`commitments` table + `attachments` Storage bucket; wipes old daily entries), `lib/dates.ts`, `lib/upload.ts`, `/api/commitments`, `/api/attachments`; extended `ProjectTask` with `what_changed` + `attachments`; replaced submit-once/edit-once with edit-until-EOD.
- `318d7c3` **Cleanup** — removed the "Carried" task status, the "Clear All Entries" bulk button, and plaintext password display (reset-only; stop returning passwords to the client).
- `3997f19` **v6 (`v6` tag)** — this release. Meril Academy rebrand (navy/gold, Manrope) across all views; manager display name/login set to **Shorya**; **Mon–Sat** working-week consistency fix in analytics (Saturday counts as a working day); **edit tracking** (`submit_count` increments on edit, "· edited" tag in EntryRow); **absent-day recovery** (editing over an absent day clears `is_absent`); seed/clear test-data scripts.

### Post-v6 terminology & UX notes (applied within the v6 line)
- "Promise" → **"Commitment"** across the UI.
- Task card redesign for clarity (prominent title, labeled hours, guided "what changed," blocker field).
- Action chips (Blocker / Screenshot / Link) restyled as consistent pills; inline link input replaced `window.prompt`.
- Console-error fixes: split CSS `background`/`border` shorthands into longhand on `<select>`/chip elements; single-tab attachment opening via `window.open` with event guards.
- `ManagerPage` font switched from the legacy Apple stack to brand Manrope.

### Post-v6 — commitment due-date visibility & Sun–Sat week
- **Explicit due dates on commitments.** When committing, employees now see the exact deadline for each commitment as a "Due «Weekday, DD Mon»" pill — the daily commitment's next-working-day date and the weekly commitment's Saturday date.
- **Week defined as Sun–Sat** (with Mon–Sat working days; Sunday non-working). The weekly commitment appears on the **first login of the week** (normally Monday) and is due that week's Saturday.
- **Saturday-first-login skips the weekly commitment.** If an employee's first login of the week is Saturday, the weekly commitment is skipped for that week (no room left to deliver). Removed the previous "Saturday targets next week's Saturday" behavior. Client-only change; no schema impact.
- **Planned:** each week's Mon–Sat work aggregated into a single **combined team summary** emailed to the manager the following Sunday (see §13, Phase 3).

### Post-v6 — carry-forward commitment tracking workflow
- **Outcomes simplified to Completed / Partial / Carry Forward; "Missed" removed.** Completed closes a commitment; Partial (some progress) and Carry Forward (none) both keep it open and roll it forward (`carry_count++`). The Partial vs Carry distinction is recorded in the outcome note. No schema change (statuses now written are only `open`/`done`; `partial`/`missed` remain accepted for legacy rows).
- **Daily:** a carried/partial daily task becomes the next day's goal, so a **new daily commitment is optional** that day. Daily follow-up still **blocks** submission (client + server).
- **Weekly = always one open weekly.** A new weekly is mandatory only when none is open (first login of week, or after completing one mid-week → targets the current week's Saturday); non-mandatory while a carried weekly is open. Carry Forward rolls the weekly to **next week's Saturday** (`nextWeekSaturday` helper).
- **Persistent weekly reminder.** An open/carried weekly is shown **every day** as a **non-blocking** card and can be Completed any day. Weekly commitments are **excluded from the daily auto-carry** and from the submit-blocking gate (client + server).
- **Reliability redefined to On-time Delivery %** = completed with `carry_count === 0` ÷ total completed. Applied to My Stats, manager Commitments tab (cards + per-member + stalled), and the CSV export summary (columns: Completed / On-time / In Progress / On-time %). Open/carried items excluded until completed.
- **Files:** `lib/dates.ts` (`nextWeekSaturday`), `api/commitments` (horizon-aware carry + daily-only auto-carry), `api/entries` (daily-only submit gate), `components/EmployeePage.tsx` (generalized `FollowUpCard`, weekly reminder, new mandatory/optional rules, metrics), `components/manager/CommitmentsTab.tsx`, `components/manager/ExportDialog.tsx`. No DB migration required.

---

## 11. Non-functional characteristics (current)

- **Performance:** Client-heavy; each tab fetches via parallel `fetch`es. `EmployeePage` fetches comments per entry (N+1). No caching layer, no pagination. Attachments compressed client-side to respect free-tier Storage.
- **Scale:** One small team (~10); 5–6 active projects. History views load wide date ranges fully into the client.
- **Availability:** Vercel + Supabase managed (free tier); no custom SLO.
- **Accessibility:** Not formally audited; inline styles, limited ARIA.
- **Observability:** `console.error` only; no metrics/tracing/alerting.
- **Testing:** No automated tests yet. Production `next build` + `eslint` are the current gates (build passes; lint surfaces advisory React-Compiler rules on the fetch-on-mount idiom, non-blocking).
- **i18n:** English only; dates `en-IN`, all logic in IST.

---

## 12. Known limitations / tech debt

- Legacy static HTML files still at repo root (`daily_work_tracker.html`, `index-v4.html`).
- Three schema files (`v1`, `v2`, `v3`), applied cumulatively; v3 is current.
- One-entry-per-day is convention, not a DB constraint.
- Styling split between inline styles and global CSS (Tailwind present but largely unused).
- Manager identity/email hardcoded in the login route.
- `submit_count` tracked but not surfaced beyond the "· edited" tag.
- Passwords stored plaintext (not displayed) — hashing pending.
- `sessionStorage` mirror of the session can drift from the cookie.

---

## 13. Forward roadmap

Deferred, in order: **email automation → Zoho Projects → enterprise hardening.**

### Phase 3 — Email & stakeholder reporting (manager convenience)
- Scheduled jobs (Vercel Cron) + email provider (e.g., Resend).
- Daily reminder to non-submitters; **daily manager digest** (what each member did today + blockers); **weekly per-member summary**.
- Build the digest as an assembled in-app object first so email becomes a trivial add.

### Enterprise-grade hardening
- **Work Items** — persist a work item across days (project or Other Work, optional Zoho task id), with multiple assignees and cross-member **dependencies/handoffs** (Waiting → Ready when upstream is Done). Commitments migrate to reference `work_item_id`.
- **Deadline integrity** — store original vs current deadline, change count, required reason on change, and **at-risk** status (progress vs time remaining).
- **Engagement/idle view** — who has active work, who's progressing, who's blocked/stalled (framed as "unblock people").
- **Leave/holiday calendar** — company holidays + employee leave, excluded from reliability & idle metrics.
- **Security** — hash passwords (bcrypt/argon2) or move employees to Supabase Auth; login rate limiting + lockout; CSRF; security headers; enable RLS as defense-in-depth.
- **Audit log** — record who changed what and when.
- **Quality** — automated tests (unit/integration/e2e) + CI; typed API layer / shared validation (e.g. Zod).
- **UX** — mobile-first/PWA pass; accessibility (WCAG); consolidate the design system.

### 13.1 Research-driven additions (from `docs/competitive-research.md`)
Derived from surveying async check-in tools (Geekbot, DailyBot, Standuply, Range, 15Five, Weekdone) and outcome-based tracking research:
1. **Auto blocker detection** on the "what changed" field (keyword heuristic feeding the Blockers tab).
2. **Employee-facing reliability + streak view** (self-correction beats manager-only reporting).
3. **Nudge + deadline mechanic** (in-app first, email later).
4. **Reframe engagement** around *blocked / waiting / stalled*, not idleness.
5. **Manager daily digest as an in-app object** first, then email.

**Cross-cutting principle:** measure output; framing matters more than the metric. Show reliability to employees, keep hours optional, never add activity surveillance (screen capture, idle timers, keystroke counts).

---

## 14. Success metrics

- Daily submission rate (% of team submitting each **Mon–Sat** working day) ≥ 90%.
- Median time to submit an update < 60s.
- On-time Delivery % trending up; stalled (3+ carry) count trending down.
- Manager same-day review of ≥ 80% of entries.
- Blocker resolution time (median age at resolve) trending down.
- Zero plaintext-credential exposure to clients (achieved: passwords no longer returned/displayed; hashing still pending).

---

## 15. Open questions

1. **Password hashing** — hash in place, or migrate employees to Supabase Auth entirely?
2. **Idle detection thresholds** — what counts as "idle" for the engagement view (no active work item, or no progress for N days)?
3. **At-risk deadline rule** — what triggers the flag (open items with < X days left and no recent progress)?
4. **Hours field** — keep the optional input as a light signal, or drop it entirely?
5. **Attachments retention** — size/type limits confirmed; define a retention policy as Storage fills.

---

## 16. Next version — Zoho Projects integration (out of scope for v6)

Built after the tracker is proven internally:
- Feasibility spike: Zoho OAuth, API scopes, mapping tracker projects/work items → Zoho projects/tasks.
- One-way push: status & progress, daily progress notes as task comments, create/update Zoho tasks.
- Mapping/config UI + sync status & error handling.

**Design constraint held in v6:** keep the data model Zoho-ready — stable identifiers and a status enum that maps cleanly to Zoho — so the integration is additive, not a rewrite.

---

*Blueprint prepared from a full read of the codebase (Next.js app in `app/`, Supabase schemas `v1`–`v3`, `proxy.ts`) and the complete git history through commit `3997f19` (`v6`, 2026-07-05).*
