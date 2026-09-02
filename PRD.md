# Product Requirements Document & Blueprint — Meril Daily Work Tracker

| Field | Value |
|-------|-------|
| Product | Meril Daily Work Tracker (Team Tracking System) |
| Owner | Rupesh Vishwkarma |
| Current version | 7.0.0 — weekly-only commitments (commit `d64656a`, main; tag `TeamTrackingV2.2`) |
| Repository | github.com/Rupesh-Vishwkarma/daily-work-tracker |
| Hosting | Vercel (auto-deploy from `main`) |
| Backend | Supabase (PostgreSQL + Supabase Auth + Storage + Realtime Broadcast) |
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5 |
| Email | Gmail SMTP via nodemailer (`ai.merillife@gmail.com`) |
| Timezone | IST (UTC+5:30); working week Monday–Saturday |
| Status | Live, internal team use |
| Document purpose | **Complete blueprint** — the as-built product end to end, the full change history, and the forward roadmap |

---

## 0. How to read this document

This is the single source of truth for the project. It has three layers:

1. **As-built (§1–§9)** — exactly what exists and runs today on `main` through `d64656a` (v6 core + v6.1 realtime + absence/export/toast + weekly summary email + **v7 weekly-only commitments**).
2. **Change history (§10)** — every commit, change, and fix from first commit through `d64656a`, so anyone can reconstruct how the product got here.
3. **Forward roadmap (§11–§16)** — what's still deferred (remaining email digests, Zoho, enterprise hardening), plus success metrics and open questions.

---

## 1. Overview

The Daily Work Tracker is an internal web app for a Meril Life Sciences engineering/XR team (~10 members, one manager). Employees log a daily work update — tasks with project, status, optional hours, "what changed since yesterday," blockers, and attachments — and make a **weekly commitment** (one open promise per week) that the app follows up on and reminds them about until it is delivered. A single manager reviews submissions, tracks projects and deadlines, surfaces blockers, monitors commitment reliability, broadcasts announcements, exports CSV reports, reads the **Weekly Report**, and manages the team roster.

It began as a static HTML prototype (`daily_work_tracker.html`, `index-v4.html` at the parent repo root — legacy) and was rebuilt as a Next.js app backed by Supabase. `v6` added the commitments accountability loop, progress evidence (attachments + what-changed), IST/Mon–Sat date logic, and a full rebrand to the Meril Academy design system. Post-v6 shipped realtime live updates (v6.1), employee self-service absence, task CSV export, submit-error toasts, and the **automated weekly summary email** (Phase 3 first slice) with an in-app Weekly Report tab. **`v7` removed the daily commitment entirely — the app now tracks only a weekly commitment, adds Edit and Cancel outcomes (each with a required reason recorded on the commitment), a new `cancelled` status that is excluded from reliability metrics, and defers every commitment action so it is only written when the employee submits that day's log.** The browser tab title is **Immersive Team**.

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
| Manager | 1 (fixed account) | Full read of all entries; review + note; manage projects, deadlines, teams; add/remove employees and **reset** passwords; broadcast; submit on behalf / mark absent; view commitment reliability & blockers; CSV export; Weekly Report (generate/send/history) |
| Employee | N (~10) | Submit/edit own daily update (editable until end of day IST); follow up on and make commitments; attach evidence; **self-mark absent** with optional reason; view own history, stats & reliability; see manager notes & broadcasts |

The manager is a single hardcoded identity in `app/api/auth/login/route.ts`: login username **`Shorya`** (case-insensitive), authenticated against a fixed Supabase Auth account (`ai.merillife@gmail.com`), with a stable internal `id: 'manager'`. Employees are rows in an `employees` table. Passwords are stored in the `employees` table and are **never returned to the client** — the manager resets them, they are not displayed.

---

## 4. As-built architecture (v6.2 / `d9cb0d1`)

### 4.1 Tech stack
- **Framework:** Next.js 16.2.9 (App Router, Turbopack), React 19.2.4, TypeScript 5.
- **Styling:** Inline styles + a shared `lib/ui.ts` (`FONT`, `BRAND`, `CARD`, `fmtDate`) and some global CSS in `globals.css` (including toast styles). Meril Academy design system — navy `#33398a`, navy-dark `#282d6e`, purple `#4b3e9d`, gold `#fdc814`, on `#f6f7fb`; **Manrope** typeface (loaded via `<link>` in `layout.tsx`). Tailwind v4 is a dependency but the UI is predominantly inline styles.
- **DB/Auth/Storage/Realtime:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`). Anon client for manager auth + Realtime Broadcast; service-role admin client (lazy singleton) for all data access. Storage bucket `attachments` (public) for screenshots/files.
- **Auth/session:** Custom signed session token (HMAC-SHA256 via Web Crypto in `lib/auth.ts`), stored in an `httpOnly` cookie `dwt_auth`, 7-day expiry, `sameSite=lax`, `secure` in production. Session summary mirrored in `sessionStorage` for client rendering.
- **Access control:** `proxy.ts` — the Next 16 middleware (renamed convention; exports `proxy` + `config.matcher = '/api/:path*'`). Verifies the session on every API request, enforces manager-only method/route rules, and injects `x-user-id`, `x-user-role`, `x-user-name` headers downstream. Confirmed active in the build output as `ƒ Proxy (Middleware)`. Cron route `/api/cron/weekly-summary` is authorized via `Authorization: Bearer $CRON_SECRET` (not the session cookie).
- **Dates:** `lib/dates.ts` — all product dates run on **IST (UTC+5:30)** with a **Mon–Sat working week** (only Sunday is non-working). Provides `todayIST`, `isWorkingDay`, `nextWorkingDay`, `prevWorkingDay`, `workingDaysBetween`, `weekMonday`, `weekSaturday`, `nextWeekSaturday`.
- **Live updates:** `lib/realtime.ts` — Supabase Broadcast channel `team-tracking` with nudge events `manager_changed` / `employee_changed`. Clients refetch via normal APIs; no row data on the socket. Mid-edit employee state is not clobbered.
- **Email:** `lib/email.ts` + nodemailer (Gmail App Password). Weekly summary HTML is deterministic from the payload (AI narrative removed in `d9cb0d1`).
- **Tests:** Vitest (`npm test`) — `lib/__tests__/summary.test.ts`, `lib/__tests__/ai.test.ts` (AI boundary still covered; narrative no longer wired into send flow).

### 4.2 App structure
```
app/
  app/
    layout.tsx        (loads Manrope; title "Immersive Team")
    page.tsx          (client; session gate → Login/Employee/Manager)
    globals.css       (brand CSS variables, buttons, chips, alerts, toasts)
    icon.svg, favicon
    api/
      auth/login, auth/logout
      entries, commitments, attachments
      projects, employees, comments, broadcast,
      reviewed, resolved-blockers
      export                  (manager CSV)
      weekly-summary         (manager GET list / POST generate|send)
      cron/weekly-summary    (Vercel Cron, CRON_SECRET)
  components/
    LoginPage.tsx, EmployeePage.tsx, ManagerPage.tsx
    manager/ TodayTab, CommitmentsTab, BlockersTab,
             ProjectsTab, HistoryTab, WeeklyReportTab,
             SettingsTab, EntryRow, ExportDialog
  lib/ auth.ts, dates.ts, supabase.ts, types.ts, ui.ts, upload.ts,
       realtime.ts, summary.ts, weekly.ts, email.ts, ai.ts
  lib/__tests__/ summary.test.ts, ai.test.ts
  proxy.ts
  vercel.json         (Sunday cron: 0 3 * * 0 → /api/cron/weekly-summary)
  scripts/ seed-test-data.mjs, clear-test-data.mjs, reset-for-golive.mjs
  supabase_schema.sql … supabase_schema_v5.sql
```

### 4.3 Data model (Supabase)

Applied in order: `supabase_schema.sql` (v1) → `v2` → `v3` → **`v4`** (`absence_note`) → **`v5`** (`weekly_summaries`) → **`v6`** (`cancelled` commitment status). RLS is disabled on all tables; the service-role key + `proxy.ts` (and cron secret) are the only access gate.

| Table | Key fields | Notes |
|-------|-----------|-------|
| `employees` | id, username, name, password, role, created_at | id = lowercase username; password never sent to client |
| `entries` | id, employee_id, employee_name, date, workload, timestamp, submit_count, is_absent, submitted_by_manager, project_tasks (jsonb), **absence_note** | One per employee per day (by convention); `project_tasks` capped at 50; `submit_count` increments on each edit; `absence_note` from v4 (optional reason) |
| `commitments` | id, employee_id, employee_name, project_id, horizon, text, due_date, created_in_entry_id, status, outcome_note, resolved_at, carry_count, created_at | The promise→follow-up→delivered loop (§6) |
| `projects` | id, name, color, lead, members (jsonb), start_date, deadline, end_date, status, previous_deadlines (jsonb), created_at | status: active/closed |
| `comments` | id, entry_id, text, author, timestamp | Manager notes on an entry |
| `reviewed_entries` | entry_id, reviewed_at | Manager "reviewed" flag |
| `resolved_blockers` | key (`entryId:taskIndex`), resolved_at | Blocker resolution state |
| `broadcast` | id (=1), message, active, updated_at | Single-row announcement |
| `weekly_summaries` | id, week_start, week_end, payload (jsonb), narrative, generated_at, sent_at, sent_to, send_error | One row per week (unique on `week_start`); narrative kept nullable / unused after AI drop |
| Storage `attachments` | public bucket | Screenshots/files; path `{userId}/{timestamp}-{safeName}` |

**`project_tasks` item shape** (jsonb): `{ project_id, task, time, status, blockers, what_changed?, attachments? }` where `status ∈ in_progress | completed | blocked` and each attachment is `{ type: 'image' | 'file' | 'link', url, name }`.

**`commitments` enums:** `horizon ∈ day | week`; `status ∈ open | done | partial | missed | cancelled` (`cancelled` added in `supabase_schema_v6.sql`). Since **v7 only weekly commitments are created** (`horizon = 'week'`); historical `day` rows are preserved for the record but no new ones are written. `project_id` may be a real id, `'__other__'` (Other Work), or null. Runtime outcomes written today are `open` / `done` / `cancelled` (Partial & Carry Forward keep the row open and bump `carry_count`; **Cancel** closes the row with `status = 'cancelled'` and a required reason in `outcome_note`, and is **excluded from reliability metrics** — it is not a broken promise). **Edit** rewrites `text` and appends a dated `"<old> -> <new> - <reason>"` audit line to `outcome_note`.

### 4.4 API surface

All session routes sit behind `proxy.ts`. "any (scoped)" = authenticated; employees are server-scoped to their own rows via `x-user-id` regardless of query params.

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/auth/login` | POST | public | Manager (Supabase Auth) or employee (table) login; sets signed cookie |
| `/api/auth/logout` | POST | any | Clear cookie |
| `/api/entries` | GET/POST/PATCH/DELETE | GET/POST/PATCH any (scoped); DELETE manager | Entries CRUD; employees scoped to own; **edit-until-EOD** lock; self-absence with optional `absence_note` (graceful if v4 column missing). *(v7: the old server-side gate that blocked submit on an overdue daily commitment was removed.)* |
| `/api/commitments` | GET/POST/PATCH/DELETE | GET/POST/PATCH any (scoped); DELETE manager | Commitments loop. **GET** returns open/resolved commitments (no auto-carry — daily auto-carry removed in v7). **PATCH** resolves (`done` / `partial` / `carry`), **edits** text (`action: 'edit'`, requires a reason), or **cancels** (`status: 'cancelled'`, requires a reason). The client stages these actions and only fires the PATCH/POST calls when the day's log is submitted (§6). |
| `/api/attachments` | POST | any (scoped) | Upload screenshot/file to Storage (≤2 MB, allowlisted types); returns public URL |
| `/api/projects` | GET any; POST/PATCH/DELETE manager | Projects CRUD |
| `/api/employees` | all manager | Roster + password management; GET **excludes** password column |
| `/api/comments` | GET any; POST/DELETE manager | Manager notes |
| `/api/reviewed` | all manager | Reviewed flags |
| `/api/resolved-blockers` | all manager | Blocker resolution |
| `/api/broadcast` | GET any; PUT manager | Announcement |
| `/api/export` | GET | manager | CSV export of entries/tasks for a date range (+ employee filter) |
| `/api/weekly-summary` | GET/POST | manager | List stored summaries; POST actions generate / send |
| `/api/cron/weekly-summary` | GET | `CRON_SECRET` | Sunday job: aggregate prior Mon–Sat week, store, email (idempotent if already sent) |

---

## 5. Functional requirements — Authentication & session

- **FR-A1:** Single login form. Username `Shorya` (case-insensitive) routes to Supabase Auth (fixed email); all others to the `employees` table (username lowercased, password compared).
- **FR-A2:** On success, a signed HMAC session cookie (`dwt_auth`, 7-day) is set; role drives which UI renders.
- **FR-A3:** On app load, a session in `sessionStorage` is validated by probing `/api/broadcast`; a 401 clears it and returns to login.
- **FR-A4:** Logout clears the cookie server-side and the `sessionStorage` mirror.
- **FR-A5:** `SESSION_SECRET` is used to sign tokens; it falls back to `SUPABASE_SERVICE_ROLE_KEY` if unset (should be set explicitly in production).

---

## 6. Functional requirements — Commitments loop (the accountability core)

Accountability comes from comparing what a member *promised* to what they *delivered*. **As of v7 the app tracks only a weekly commitment** — the daily commitment and its blocking follow-up were removed because a daily promise was too recurring and almost always carried forward. The employee's daily flow is three steps.

**Step 1 — Follow up (weekly).** The app surfaces the open **weekly** commitment as a **non-blocking reminder every day** (it never blocks the daily update). The employee can act on it — **Completed / Partial / Carry Forward / Edit / Cancel** — from any day:
- **Completed** closes it (`done`). **Partial** (some progress) and **Carry Forward** (none) keep it open and roll it to next week's Saturday, bumping `carry_count`.
- **Edit** changes the wording (e.g. scope shifted) and **requires a short reason**, which is appended to the commitment's `outcome_note` as a dated audit line.
- **Cancel** drops a commitment that no longer applies. It **requires a reason**, sets `status = 'cancelled'`, and is **excluded from reliability metrics** (not counted as missed/broken). Because the rule is always one open weekly, **cancelling forces the employee to enter a replacement weekly commitment before they can submit**.

**Deferred writes (v7).** None of the Step-1 actions hit the database when clicked — they are **staged locally** and shown as a pending banner (with **Undo**). They are only applied when the employee **submits that day's log**. If they leave without submitting (or hit Cancel on the form), the staged changes are **discarded** and nothing changes in the database. This prevents a commitment change from being saved without the accompanying daily update.

**Step 2 — Log.** Enter today's work as task rows (§7.1), *or* mark self absent (§7.4).

**Step 3 — Commit.** The rule is **always have exactly one open weekly commitment**. A new weekly (due that week's Saturday) is **mandatory when none is open** — the first login of the week, right after completing one mid-week, or when the currently open one is being **cancelled/completed in this same submission**. It is **non-mandatory while a carried/open weekly remains**, and **skipped** if the first login of the week is Saturday with nothing open. The input's copy adapts (e.g. "replacement weekly commitment" when the open one is being closed). Each commitment's exact due date is shown (a "Complete by «Weekday, DD Mon»" pill).

**Weekly carry & persistent reminder.** On Saturday the weekly is typically resolved **Completed / Partial / Carry Forward**. Partial/Carry Forward roll it to **next week's Saturday** and keep it open. A carried/open weekly is shown **every day as a non-blocking reminder** and can be resolved on any day. When completed or cancelled mid-week, a new weekly for the current week's Saturday becomes mandatory again; once Completed/Cancelled it disappears from the reminder.

**Rules & signals:**
- The week runs **Sun–Sat** with **Mon–Sat working days** (Sunday is non-working; employees do not submit on Sunday).
- **Weekly summary (shipped):** each week's Mon–Sat work is aggregated into a combined team summary, emailed to the manager on Sunday and viewable in the manager **Weekly Report** tab (§8.7).
- **No auto-carry:** weekly commitments are **never** auto-carried — they stay open as a persistent reminder and roll only via explicit Partial/Carry Forward. (The v6 daily-only auto-carry on GET was removed with the daily commitment in v7.)
- **On-time Delivery %** = completed **without ever carrying** (`carry_count === 0`) ÷ total completed, per employee per period — the headline metric shown to both manager (Commitments tab) and employee (My Stats). Open/carried commitments are excluded until completed; **cancelled commitments are excluded from both the numerator and denominator** so a legitimate scope change never dents reliability.
- A commitment **carried 3+ times** is escalated on the manager's Commitments tab as **stalled work**.
- **Server enforcement:** POST `/api/commitments` validates required fields, horizon, and scopes `employee_id` to the caller; PATCH enforces ownership and valid action/status and **requires a reason for `edit` and `cancelled`**; DELETE is manager-only.

---

## 7. Functional requirements — Employee

### 7.1 Daily update (task rows)
- **FR-E1:** Add N task rows. Each row: project picker (My Projects / Other Projects / Other Work), task title, **optional** hours, status (In progress / Completed / Blocked), optional blocker text, **required "what changed since yesterday,"** and optional attachments.
- **FR-E2:** Status indicator circle per task: in-progress = navy ring, completed = solid green ✓, blocked = solid red !.
- **FR-E3:** Attachments per task — **screenshot/image** and **file** upload (client-compressed, ≤2 MB, allowlisted types) and **inline link** entry. Attachments open in a single new tab.
- **FR-E4:** Overall workload selector (light / medium / heavy).
- **FR-E5:** Submit validation: ≥1 task with a title; "what changed" filled for every task; a weekly commitment whenever no open weekly will remain after this submission — i.e. none is open, or the open one is being completed/cancelled in this same submission — except on a Saturday first-login with nothing open. On submit, the entry is saved first, then any **staged** weekly-commitment actions (complete/partial/carry/edit/cancel) are applied, then the replacement weekly (if required) is created. *(v7: there is no longer a daily-commitment requirement or a daily follow-up gate.)*
- **FR-E5b:** Submit failures surface as a **fixed error toast** (auto-dismissible), not an inline banner that can scroll out of view.

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
- **FR-E14:** Live refresh via Realtime nudge when the manager changes something that affects this employee (notes, review, absent, broadcast, etc.), without clobbering an in-progress edit.

### 7.4 Self-service absence
- **FR-E15:** Employee can mark **themselves absent** for today with an optional reason (`absence_note`).
- **FR-E16:** Self-absence **bypasses** the open-commitments submit gate (no work to close out on a day off).
- **FR-E17:** Reason (if provided) is visible to the manager on Today / EntryRow and included in CSV export.

---

## 8. Functional requirements — Manager

### 8.1 Today
- **FR-M1:** Stat cards (Submitted, Pending, Heavy, Medium, Light) that act as filters.
- **FR-M2:** "Yet to Submit" list with per-employee **Absent** and **Submit on behalf** actions (modal).
- **FR-M2b:** **Absent Today** section surfaces self-reported absences (and optional reasons) separately from manager-marked absences.
- **FR-M3:** Expand an entry to view tasks, what-changed, attachments, blockers; **mark reviewed / unmark**; **add manager note**.
- **FR-M4:** Delete an entry; entries show an "· edited" tag when revised.
- **FR-M5:** Manager can log their own daily update.
- **FR-M6:** Filter by employee name.
- **FR-M7:** Live refresh via Realtime nudge when employees submit/edit.

### 8.2 Commitments
- **FR-C1:** Team stat cards — On-time Delivery %, Commitments Made, Completed, Due/Overdue, Stalled (3+ carries). **Cancelled commitments are excluded** from Commitments Made and the reliability denominator (a scope change is not a broken promise).
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

### 8.5 History & export
- **FR-H1:** Calendar view (default) — workload dots per day, per-date submissions, missing-employee count.
- **FR-H2:** Weekly dashboard — per-employee week nav, day-by-day hours (Mon–Sat working days), project time, completion rate, CSV.
- **FR-H3:** People dashboard — per-employee reliability (submitted ÷ **Mon–Sat** working days %), output, workload mix, project table, period selector (week/month/3m/all).
- **FR-H4:** List view — grouped by date, employee filter, CSV export, per-employee workload stat cards.
- **FR-H5:** Date range with 7/30/90-day quick presets (list view).
- **FR-H6:** **Export dialog** — manager-facing CSV of tasks/entries via `/api/export` (date range, optional employee filter); absences labeled with optional reason.

### 8.6 Settings
- **FR-S1:** Broadcast editor (message + active toggle).
- **FR-S2:** Team member table (no passwords shown); **reset password** inline; remove member (entries kept).
- **FR-S3:** Add employee (name, username, password).

### 8.7 Weekly Report (shipped — Phase 3 slice)
- **FR-W1:** Manager **Weekly Report** tab lists stored `weekly_summaries` for past weeks.
- **FR-W2:** **Generate now** builds the deterministic payload (per-employee brief + needs-attention) for a target week and upserts `weekly_summaries`.
- **FR-W3:** **Send now** emails the HTML digest via Gmail SMTP (recipients: `WEEKLY_TO` / `WEEKLY_CC` env, defaulting to manager + `ai.merillife@gmail.com`).
- **FR-W4:** **Sunday cron** (`vercel.json` → `/api/cron/weekly-summary`, `0 3 * * 0`) auto-generates and sends the just-finished Mon–Sat week; skips if that week already has `sent_at`.
- **FR-W5:** Email content is **deterministic only** — Gemini/AI narrative was removed (`d9cb0d1`); `narrative` may be stored as null. `lib/ai.ts` remains in tree for optional reuse / boundary tests but is not wired into the send path.

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
- Cron endpoint gated by `CRON_SECRET`.
- Realtime Broadcast carries only event name + optional employee id (no row payloads).
- Weekly-summary AI input boundary (when used) strips credentials / free-text notes — still covered by unit tests even though narrative send is disabled.

### Known security gaps (tracked for hardening)
- Employee passwords are stored in **plaintext** in the DB (no longer displayed, but not hashed).
- No rate limiting on `/api/auth/login` (brute-force exposure).
- No CSRF token (relies on `sameSite=lax`).
- RLS disabled — all DB security depends on the proxy + service-role key.
- `SESSION_SECRET` falls back to the service-role key if unset.
- No audit log of mutations yet.

---

## 10. Complete change history (first commit → `d9cb0d1`)

Chronological. Tags: `v1.0.0`, `v2.0.0`, `v4.0.0`, `v4.1`, `v5`, `v6`. Line versions after that: **v6.1** (realtime), **v6.2** (weekly summary + absence/export). Restore-point tags for the v7 commitment rework: `TeamTrackingV1` (pre-removal snapshot), `TeamTrackingV2`, `TeamTrackingV2.1`, `TeamTrackingV2.2`.

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

### Docs rewrite
- `de9ab28` **docs: rewrite PRD as complete v6 blueprint** — this document's v6 baseline.

### v6.1 — realtime + branding polish (2026-07)
- `30a5a8b` **v6.1: realtime live updates + logo/favicon polish** — Supabase Broadcast nudge bus (`lib/realtime.ts`); silent refetch on employee + manager tabs; mid-edit deferral; Meril logo viewBox/size fix; wordmark favicon via `icon.svg`.
- `7fb3d32` **chore: update site title to Immersive Team.**

### Export, toast, self-service absence
- `547316f` **Export tasks** — `/api/export` + `ExportDialog` (History) for manager CSV.
- `2cd342b` **Show submit errors as a fixed toast** instead of an inline banner.
- `9e28e9a` **Add employee self-service absence with optional reason** — `absence_note` column (`supabase_schema_v4.sql`), Today "Absent Today" section, export labeling, `scripts/reset-for-golive.mjs`. Graceful write fallback if v4 not yet applied.

### Post-v6 — commitment due-date visibility & Sun–Sat week
- `3d3ab53` **Show commitment due dates; skip weekly commitment on Saturday-first login.** Explicit "Due «Weekday, DD Mon»" pills; week = Sun–Sat with Mon–Sat working days; Saturday-first-login skips creating a weekly for that week.
- Client-only change for the Saturday skip; no schema impact.

### Post-v6 — carry-forward commitment tracking workflow
- `8848261` **Carry-forward commitment workflow:** outcomes simplified to Completed / Partial / Carry Forward ("Missed" removed from UX). Daily: carried/partial becomes next day's goal → new daily optional; daily follow-up still blocks submit. Weekly: always one open weekly; persistent non-blocking reminder; carry rolls to next week's Saturday (`nextWeekSaturday`). Reliability = **On-time Delivery %**. Files: `lib/dates.ts`, `api/commitments`, `api/entries`, `EmployeePage`, `CommitmentsTab`, `ExportDialog`.

### v6.2 — weekly summary email (Phase 3 first slice)
- `2146ac6` **feat(weekly-summary): automated weekly team summary email** — Sunday Vercel cron; Gmail SMTP; manager Weekly Report tab (generate/send/history); `weekly_summaries` table (`supabase_schema_v5.sql`); `lib/summary.ts` / `weekly.ts` / `email.ts` / `ai.ts`; Vitest coverage for aggregation + AI data boundary.
- `d9cb0d1` **refactor(weekly-summary): drop AI narrative, clean up email** — Gemini narrative removed from email and Weekly Report UI (duplicated deterministic breakdown / raw markdown); narrative stored as null; Gemini no longer wired into the send flow; redundant per-item "review on the dashboard" links removed from Needs attention.

### Post-v6.2 — weekly reminder deadline pill
- **Weekly commitment "Complete by" deadline pill** (`EmployeePage.tsx`) — the weekly reminder card header now shows a prominent "Complete by «date»" pill (earliest open weekly due date), and each commitment row uses horizon-aware wording ("Complete by" for weekly, "Due" for daily) with the accent color, so the deadline is unmistakable. Client-only; no schema impact.

### v7 — weekly-only commitments (2026-09)
The commitment model was simplified from a daily + weekly pair to **weekly-only**, with richer outcomes and deferred writes. Rolled out in staged, individually-tagged restore points. **No historical data was deleted** — existing `horizon = 'day'` rows remain for the record; the app simply stops creating and following up on daily commitments.
- `1622170` **(`TeamTrackingV1`)** Pre-removal snapshot — also shipped the weekly reminder "Complete by" deadline pill; this tag is the restore point before the daily commitment was removed.
- `ad33bbf` **(`TeamTrackingV2`) Remove daily commitment, keep only weekly.** Dropped the daily commitment input, its blocking follow-up, and the daily auto-carry on GET; removed the server-side submit gate on overdue daily commitments (`api/entries`). Weekly commitment retained as a non-blocking, once-per-week reminder. Files: `api/commitments`, `api/entries`, `EmployeePage`.
- `935561a` **(`TeamTrackingV2.1`) Add Edit and Cancel for the weekly commitment.** New `cancelled` status (`supabase_schema_v6.sql`, extends the `commitments_status_check` constraint; `CommitmentStatus` type); PATCH handles `action: 'edit'` and `status: 'cancelled'`; **Edit and Cancel each require a comment/reason** recorded on the commitment (edits append a dated `"<old> -> <new> - <reason>"` audit line to `outcome_note`). Cancelled commitments are excluded from delivery/reliability metrics in `CommitmentsTab` and My Stats (new "Cancelled" chip).
- `d64656a` **(`TeamTrackingV2.2`, current) Defer weekly edit/cancel to daily-log submit.** All weekly-commitment actions (Complete/Partial/Carry/Edit/Cancel) are **staged client-side** (`pendingCommit`) with an Undo affordance and only written when the day's log is submitted; leaving without submitting discards them. Cancelling forces a replacement weekly before submit. `FollowUpCard` refactored to stage via `onStage`/`onUnstage`; `handleSubmit` saves the entry, applies staged commits, then creates the replacement weekly; `needWeekly` recomputed from staged closures.

### Operations
- **2026-08-26 — Gmail App Password rotated.** The weekly summary email failed in production with `535-5.7.8 BadCredentials`; the Gmail App Password was regenerated and updated in Vercel (Production) + local `.env.local`, then redeployed. Config-only, no code change. Rotation runbook lives in `README.md`; incident recorded in `RISKS_AND_ISSUES.md`.
- **2026-09 — Accidental weekly-commitment cancellations restored.** During testing against a stale (pre-v7.2) cached bundle, two open weekly commitments (Prem, Rupesh) were cancelled without a submit. They were restored (`status → open`, cleared `resolved_at`/`outcome_note`) via a one-off service-role script (since removed). Root cause was a stale browser bundle, not a code defect; the fix was a hard refresh.

---

## 11. Non-functional characteristics (current)

- **Performance:** Client-heavy; each tab fetches via parallel `fetch`es. `EmployeePage` fetches comments per entry (N+1). No caching layer, no pagination. Attachments compressed client-side to respect free-tier Storage. Realtime nudges replace polling for freshness.
- **Scale:** One small team (~10); 5–6 active projects. History views load wide date ranges fully into the client.
- **Availability:** Vercel + Supabase managed (free tier); no custom SLO. Weekly cron on Vercel Hobby is once-per-day frequency (timing not guaranteed to the minute).
- **Accessibility:** Not formally audited; inline styles, limited ARIA; submit toast uses `role="alert"`.
- **Observability:** `console.error` only; no metrics/tracing/alerting.
- **Testing:** Vitest unit tests for weekly summary aggregation and AI input allowlisting (`npm test`). Production `next build` + `eslint` remain deploy gates (lint may surface advisory React-Compiler rules on fetch-on-mount, non-blocking). No e2e suite yet.
- **i18n:** English only; dates `en-IN`, all logic in IST.

---

## 12. Known limitations / tech debt

- Legacy static HTML files still at the parent repo root (`daily_work_tracker.html`, `index-v4.html`).
- Six schema files (`v1`–`v6`), applied cumulatively; **v6 is current** (adds the `cancelled` status; requires v5 `weekly_summaries` and v4 `absence_note` first).
- One-entry-per-day is convention, not a DB constraint.
- Styling split between inline styles and global CSS (Tailwind present but largely unused).
- Manager identity/email hardcoded in the login route.
- `submit_count` tracked but not surfaced beyond the "· edited" tag.
- Passwords stored plaintext (not displayed) — hashing pending.
- `sessionStorage` mirror of the session can drift from the cookie.
- `lib/ai.ts` / Gemini path remains in tree but is unused in the live send flow after `d9cb0d1`.
- Daily reminder / daily manager digest emails from original Phase 3 list are not built yet.

---

## 13. Forward roadmap

Deferred, in order: **remaining email automation → Zoho Projects → enterprise hardening.**

### Phase 3 — Email & stakeholder reporting (partially shipped)
**Shipped:** weekly combined team summary (Sunday cron + in-app Weekly Report + Gmail SMTP).
**Still deferred:**
- Daily reminder to non-submitters.
- **Daily manager digest** (what each member did today + blockers).
- Optional re-enable of AI narrative (or delete `lib/ai.ts` if permanently unused).
- Build further digests as assembled in-app objects first so email stays a thin transport.

### Enterprise-grade hardening
- **Work Items** — persist a work item across days (project or Other Work, optional Zoho task id), with multiple assignees and cross-member **dependencies/handoffs** (Waiting → Ready when upstream is Done). Commitments migrate to reference `work_item_id`.
- **Deadline integrity** — store original vs current deadline, change count, required reason on change, and **at-risk** status (progress vs time remaining).
- **Engagement/idle view** — who has active work, who's progressing, who's blocked/stalled (framed as "unblock people").
- **Leave/holiday calendar** — company holidays + employee leave, excluded from reliability & idle metrics.
- **Security** — hash passwords (bcrypt/argon2) or move employees to Supabase Auth; login rate limiting + lockout; CSRF; security headers; enable RLS as defense-in-depth.
- **Audit log** — record who changed what and when.
- **Quality** — expand automated tests (integration/e2e) + CI; typed API layer / shared validation (e.g. Zod).
- **UX** — mobile-first/PWA pass; accessibility (WCAG); consolidate the design system.

### 13.1 Research-driven additions (from `docs/competitive-research.md`)
Derived from surveying async check-in tools (Geekbot, DailyBot, Standuply, Range, 15Five, Weekdone) and outcome-based tracking research:
1. **Auto blocker detection** on the "what changed" field (keyword heuristic feeding the Blockers tab).
2. **Employee-facing reliability + streak view** (self-correction beats manager-only reporting) — partially addressed by My Stats On-time Delivery %.
3. **Nudge + deadline mechanic** (in-app first, email later) — in-app Realtime nudge shipped; email nudges still open.
4. **Reframe engagement** around *blocked / waiting / stalled*, not idleness.
5. **Manager daily digest as an in-app object** first, then email — weekly digest shipped; daily still open.

**Cross-cutting principle:** measure output; framing matters more than the metric. Show reliability to employees, keep hours optional, never add activity surveillance (screen capture, idle timers, keystroke counts).

---

## 14. Success metrics

- Daily submission rate (% of team submitting each **Mon–Sat** working day) ≥ 90%.
- Median time to submit an update < 60s.
- On-time Delivery % trending up; stalled (3+ carry) count trending down.
- Manager same-day review of ≥ 80% of entries.
- Blocker resolution time (median age at resolve) trending down.
- Zero plaintext-credential exposure to clients (achieved: passwords no longer returned/displayed; hashing still pending).
- Weekly summary email delivers successfully each Sunday (or skip with clear `send_error` / idempotent already-sent).

---

## 15. Open questions

1. **Password hashing** — hash in place, or migrate employees to Supabase Auth entirely?
2. **Idle detection thresholds** — what counts as "idle" for the engagement view (no active work item, or no progress for N days)?
3. **At-risk deadline rule** — what triggers the flag (open items with < X days left and no recent progress)?
4. **Hours field** — keep the optional input as a light signal, or drop it entirely?
5. **Attachments retention** — size/type limits confirmed; define a retention policy as Storage fills.
6. **AI narrative** — permanently drop Gemini (`lib/ai.ts`), or keep as optional opt-in later?

---

## 16. Next version — Zoho Projects integration (out of scope for current line)

Built after the tracker is proven internally:
- Feasibility spike: Zoho OAuth, API scopes, mapping tracker projects/work items → Zoho projects/tasks.
- One-way push: status & progress, daily progress notes as task comments, create/update Zoho tasks.
- Mapping/config UI + sync status & error handling.

**Design constraint held since v6:** keep the data model Zoho-ready — stable identifiers and a status enum that maps cleanly to Zoho — so the integration is additive, not a rewrite.

---

*Blueprint updated from the codebase and git history through commit `d64656a` (`feat(commitments): defer weekly edit/cancel to daily-log submit`, tag `TeamTrackingV2.2`, 2026-09). This is the **v7.0 weekly-only commitments** line: the daily commitment and its blocking follow-up were removed, Edit/Cancel outcomes (each with a required reason) were added on top of a new `cancelled` status (`supabase_schema_v6.sql`), and all commitment actions are now deferred until the day's log is submitted. Prior baselines: `d9cb0d1` (v6.2 weekly summary), plus the 2026-08-26 Gmail App Password rotation (config-only, see Operations).*
