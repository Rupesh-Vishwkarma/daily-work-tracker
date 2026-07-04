# Product Requirements Document — Meril Daily Work Tracker

| Field | Value |
|-------|-------|
| Product | Meril Daily Work Tracker (Team Tracking System) |
| Owner | Rupesh Vishwkarma |
| Current version | 5.0.0 |
| Repository | github.com/Rupesh-Vishwkarma/daily-work-tracker |
| Hosting | Vercel (auto-deploy from `main`) |
| Backend | Supabase (PostgreSQL + Supabase Auth) |
| Status | Live, internal team use |
| Document purpose | Capture the as-built product, then define the target for an enterprise-grade version |

---

## 1. Overview

The Daily Work Tracker is an internal web app for a Meril Life Sciences engineering/XR team. Employees log a daily work update (tasks, project, hours, status, blockers, workload). A single manager reviews submissions, tracks projects and deadlines, surfaces blockers, broadcasts announcements, and manages the team roster.

It began as a single static HTML file (`daily_work_tracker.html`, `index-v4.html` at the repo root — legacy) and was rebuilt as a Next.js app in `app/`, backed by Supabase, with a security-hardening pass in v5.

### Vision
A fast, low-friction daily standup replacement that gives one manager a clear, real-time picture of what the team is doing, where time goes, and what's blocked — without the overhead of a heavyweight project management tool.

---

## 2. Problem statement

- Managers lack a consolidated, daily view of who did what, how loaded people are, and what's blocking progress.
- Verbal/standup or chat updates aren't searchable, aren't tied to projects, and produce no history or metrics.
- Existing PM tools (Jira, etc.) are too heavy for a small team's daily check-in.

---

## 3. Goals & non-goals

### Goals (current)
- One-tap daily submission for employees (<1 min to fill).
- Manager gets same-day visibility: submitted vs pending, workload distribution, blockers.
- Per-project time and contribution tracking.
- Historical views (calendar, weekly, per-person, list) with CSV export.
- Role-based access with a secure session model.

### Non-goals (current)
- Not a full project/task management tool (no kanban, dependencies, sprints).
- Not multi-tenant — built for a single team with a single manager.
- No mobile native app (responsive web only).
- No integrations (Slack/Teams/email) yet.

---

## 4. Personas & roles

| Role | Count | Capabilities |
|------|-------|--------------|
| Manager | 1 (fixed account) | Full read of all entries; review + note; manage projects, deadlines, teams; manage employees & passwords; broadcast; submit on behalf / mark absent; clear data; CSV export |
| Employee | N | Submit/edit own daily update (edit once); view own history & stats; see manager notes & broadcasts |

The manager is a single hardcoded identity (`Manager` / `ai.merillife@gmail.com`) authenticated via Supabase Auth. Employees are rows in an `employees` table with plaintext passwords.

---

## 5. Current architecture (as-built)

### 5.1 Tech stack
- **Framework:** Next.js 16.2.9 (App Router), React 19.2, TypeScript 5.
- **Styling:** Inline styles + a small shared `lib/ui.ts` (FONT, CARD, `fmtDate`); some global CSS classes in `globals.css`. Apple/iOS-inspired "v4" design system (SF Pro, pill buttons, segmented controls). Tailwind v4 is a dependency but the UI is predominantly inline styles.
- **DB/Auth:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`). Anon client for manager auth; service-role admin client for all data access.
- **Auth/session:** Custom signed session token (HMAC-SHA256 via Web Crypto), stored in an `httpOnly` cookie `dwt_auth`, 7-day expiry. Session summary also mirrored in `sessionStorage` for client rendering.
- **Access control:** `proxy.ts` (Next middleware, matcher `/api/:path*`) verifies the session on every API request and enforces manager-only method/route rules; injects `x-user-id`, `x-user-role`, `x-user-name` headers downstream.

### 5.2 App structure
```
app/
  app/
    layout.tsx, page.tsx, globals.css, icon.svg, favicon.ico
    api/
      auth/login, auth/logout
      broadcast, comments, employees, entries, projects,
      reviewed, resolved-blockers
  components/
    LoginPage, EmployeePage, ManagerPage
    manager/ TodayTab, BlockersTab, ProjectsTab, HistoryTab, SettingsTab, EntryRow
  lib/ auth.ts, supabase.ts, types.ts, ui.ts
  proxy.ts
  supabase_schema.sql, supabase_schema_v2.sql
```
`app/page.tsx` is a client component that switches between `LoginPage`, `EmployeePage`, and `ManagerPage` based on session role.

### 5.3 Data model (Supabase, `supabase_schema_v2.sql`)

| Table | Key fields | Notes |
|-------|-----------|-------|
| `employees` | id, username, name, password, role, created_at | Password is plaintext; id = lowercase username |
| `entries` | id (uuid), employee_id, employee_name, date, workload, timestamp, submit_count, is_absent, submitted_by_manager, project_tasks (jsonb) | One per employee per day (by convention, not enforced); `project_tasks` capped at 50 |
| `projects` | id, name, color, lead, members (jsonb), start_date, deadline, end_date, status, previous_deadlines (jsonb), created_at | status: active/closed |
| `comments` | id, entry_id, text, author, timestamp | Manager notes on an entry |
| `reviewed_entries` | entry_id, reviewed_at | Manager "reviewed" flag |
| `resolved_blockers` | key (`entryId:taskIndex`), resolved_at | Blocker resolution state |
| `broadcast` | id (=1), message, active, updated_at | Single-row announcement |

`project_tasks` item shape: `{ project_id, task, time, status, blockers }` where status ∈ `in_progress | completed | blocked | carried`. RLS is disabled on all tables; the service-role key + proxy are the only access gate.

### 5.4 API surface

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/auth/login` | POST | public | Manager (Supabase Auth) or employee (table) login; sets cookie |
| `/api/auth/logout` | POST | any | Clear cookie |
| `/api/entries` | GET/POST/PATCH/DELETE | GET/POST/PATCH any (scoped); DELETE manager | Entries CRUD; employees scoped to own; edit limited to once (submit_count ≥ 2 blocked) |
| `/api/projects` | GET any; POST/PATCH/DELETE manager | Projects CRUD |
| `/api/employees` | all manager | Roster + password management (returns plaintext password) |
| `/api/comments` | GET any; POST/DELETE manager | Manager notes |
| `/api/reviewed` | all manager | Reviewed flags |
| `/api/resolved-blockers` | all manager | Blocker resolution |
| `/api/broadcast` | GET any; PUT manager | Announcement |

---

## 6. Functional requirements (current, implemented)

### 6.1 Authentication
- FR-A1: Single login form; username `Manager` routes to Supabase Auth, all others to the `employees` table.
- FR-A2: On success, a signed HMAC session cookie (7-day) is set; role drives UI.
- FR-A3: On app load, a stale pre-v5 session in `sessionStorage` is detected by probing `/api/broadcast`; a 401 clears it.
- FR-A4: Any 401 during use should log the user out (documented intent).

### 6.2 Employee
- FR-E1: Submit today's update — add N tasks, each with project, free-text task, hours (0–24), status, optional blocker text; pick overall workload (light/medium/heavy).
- FR-E2: Edit today's submission exactly once (`submit_count` enforced server-side, max 2).
- FR-E3: View submitted state with confirmation card; see manager notes on entries.
- FR-E4: "My Stats" — total updates, hours logged, completion rate, workload distribution, task outcomes, project breakdown (last 30 days window loaded).
- FR-E5: Recent history (last 5 non-today entries) with manager notes.
- FR-E6: See active broadcast banner (dismissible).
- FR-E7: Project picker groups "My Projects" (member/lead) vs "Other Projects" vs "Other Work".

### 6.3 Manager — Today
- FR-M1: Stat cards (Submitted, Pending, Heavy, Medium, Light) that act as filters.
- FR-M2: "Yet to Submit" list with per-employee "Absent" and "Submit on behalf" actions.
- FR-M3: Expand an entry to view tasks; mark reviewed / unmark; add manager note.
- FR-M4: Delete an entry.
- FR-M5: Manager can log their own daily update.
- FR-M6: Filter by employee name.

### 6.4 Manager — Blockers
- FR-B1: List all tasks in the last 30 days that are `blocked` OR have non-empty blocker text.
- FR-B2: Age indicator (Today/Yesterday/Nd ago) with color escalation.
- FR-B3: Resolve/reopen a blocker (persisted by `entryId:taskIndex` key).
- FR-B4: Show/hide resolved.

### 6.5 Manager — Projects
- FR-P1: Create project (name→slug id, lead, members, start, deadline, color).
- FR-P2: Per-project stats: today count, total submissions, last activity, total hours, per-member contributions.
- FR-P3: Deadline alerts (overdue, due within 7 days).
- FR-P4: Edit deadline (set or extend; keeps `previous_deadlines` history).
- FR-P5: Inline rename; mark complete (archive with end_date); delete.
- FR-P6: Edit team & lead; members who have logged work are locked from removal (🔒).
- FR-P7: Completed projects section with on-time / missed-deadline badges and contribution bars.

### 6.6 Manager — History
- FR-H1: Calendar view (default) — workload dots per day, per-date submissions, missing-employee count.
- FR-H2: Weekly dashboard — per-employee week nav, day-by-day hours, project time, completion rate, CSV.
- FR-H3: People dashboard — per-employee reliability (submitted/working days %), output, workload mix, project table, period selector (week/month/3m/all).
- FR-H4: List view — grouped by date, employee filter, CSV export, per-employee workload stat cards.
- FR-H5: Date range with 7/30/90-day quick presets (list view).

### 6.7 Manager — Settings
- FR-S1: Broadcast editor (message + active toggle).
- FR-S2: Team member table (shows plaintext passwords), edit password inline, remove member (entries kept).
- FR-S3: Add employee (name, username, password).
- FR-S4: Data — total entry count; "Clear All Entries" (fires N concurrent DELETEs).

---

## 7. Security model (current)

- Server-side signed session cookie (`httpOnly`, HMAC-SHA256); role cannot be forged client-side.
- Central enforcement in `proxy.ts`; manager-only routes/methods gated there.
- Employees can only read/write their own entries (server-scoped by `x-user-id`).
- Entry IDs are UUIDs (non-enumerable).
- JSONB payload bounds (`project_tasks` ≤ 50).
- Startup env validation for Supabase creds.

### Known security gaps
- Employee passwords stored and transmitted in **plaintext**; manager Settings UI displays them.
- No rate limiting on `/api/auth/login` (brute-force exposure).
- No CSRF token (relies on `sameSite=lax` cookie).
- RLS disabled — all DB security depends on the proxy + service-role key.
- `SESSION_SECRET` falls back to the service-role key if unset.
- No audit log of mutations.
- No password reset flow (manager edits via Settings/Supabase console).

---

## 8. Non-functional characteristics (current)

- **Performance:** Client-heavy; each tab fetches via multiple parallel `fetch`es. `EmployeePage` fetches comments per entry (N+1). No caching layer, no pagination.
- **Scale:** Designed for one small team; history views load wide date ranges (e.g. `from=2024-01-01`) fully into the client.
- **Availability:** Vercel + Supabase managed; no custom SLO.
- **Accessibility:** Not audited; inline styles, limited semantic structure, no keyboard/ARIA guarantees.
- **Observability:** `console.error` only; no metrics, tracing, or alerting.
- **Testing:** No automated tests present.
- **i18n:** English only; dates formatted `en-IN`.

---

## 9. Known limitations / tech debt

- Legacy static HTML files still tracked at repo root (`daily_work_tracker.html`, `index-v4.html`, `daily_work_tracker_v1.html`).
- Two schema files (`v1`, `v2`); v2 is current.
- One-entry-per-day is convention, not a DB constraint.
- Styling split between inline styles and global CSS classes (inconsistent; Tailwind present but largely unused).
- Bulk delete is N requests, not one endpoint.
- Manager identity and email are hardcoded in the login route.
- `sessionStorage` mirror of session can drift from the cookie.

---

## 10. Gap analysis → enterprise-grade (input for brainstorming)

The following are **candidate** improvement areas, grouped by theme. These are not yet committed requirements — they're the menu for the brainstorming session.

### 10.1 Security & compliance
- Hash passwords (bcrypt/argon2) or move fully to Supabase Auth / SSO (Google/Microsoft/SAML).
- Remove plaintext password display; add self-service password reset.
- Rate limiting + lockout on login; CSRF protection; security headers/CSP.
- Enable Postgres RLS as defense-in-depth; scope service-role usage.
- Audit logging for all mutations; data retention & export (GDPR-style).

### 10.2 Multi-tenancy & roles
- Support multiple teams/departments and multiple managers.
- Role hierarchy (admin, manager, team lead, employee); org/team scoping.
- Delegation / approver chains.

### 10.3 Product depth
- Task carry-over automation ("carried" → next day pre-fill).
- Goals/OKRs, sprint or weekly targets, capacity planning.
- Richer blockers: assignee, severity, SLA, escalation, comments thread.
- Attachments/links on tasks and updates.
- Templates and recurring tasks.

### 10.4 Analytics & reporting
- Manager overview dashboard across the whole team (currently per-employee).
- Trends over time (velocity, utilization, blocker aging), exportable PDF/scheduled reports.
- Per-project burn-up / timeline; time-tracking accuracy.

### 10.5 Notifications & integrations
- Email/Slack/Teams reminders for missing submissions and new blockers.
- Broadcast delivery beyond in-app banner; read receipts.
- Calendar / HRIS / SSO integrations; webhook/API for external tools.

### 10.6 UX & platform
- Mobile-first / PWA / offline submission.
- Accessibility (WCAG) pass; dark mode; consistent design system (consolidate on Tailwind or a component lib).
- Performance: server-side data fetching, pagination, caching, remove N+1 comment fetches.

### 10.7 Engineering quality
- Automated tests (unit/integration/e2e), CI checks, preview environments.
- Typed API layer / shared schema validation (e.g. Zod).
- Enforce one-entry-per-day via DB constraint; bulk operations endpoints.
- Observability: error tracking (Sentry), logging, uptime/alerting.

---

## 11. Success metrics (proposed)

- Daily submission rate (% of team submitting each working day) ≥ 90%.
- Median time to submit an update < 60s.
- Manager time-to-review: same-day review of ≥ 80% of entries.
- Blocker resolution time (median age at resolve) trending down.
- Zero plaintext-credential exposure (post-hardening).

---

## 12. Open questions (for brainstorming)

1. Will this stay single-team, or must it support multiple teams/managers?
2. Is SSO (Google/Microsoft) required, and can we drop custom credentials entirely?
3. What's the required data-retention / compliance posture (it's a life-sciences org)?
4. Is mobile/offline use a real need for the team?
5. Should notifications (missing submission, new blocker) be in-app only or Slack/email/Teams?
6. Is time tracking meant to be precise (billing/utilization) or a rough signal?
7. What reporting do stakeholders above the manager need, if any?

---

## 13. v6 target — decisions (from brainstorming, 2026-07-04)

Scope stays **single-team, single-manager**. No SSO. Internal use in a life-sciences org. **This version's goal: an enterprise-grade tracker that is Zoho-ready but does NOT yet integrate.** Zoho Projects integration is the **next-version milestone** (§16), built once the tracker requirements are fully satisfied.

### Manager's operating philosophy (drives the design)
- **Output over hours.** Whether a task took 4h or 8h is irrelevant; what matters is that it got done and moved forward. Time is a weak signal — completion and visible progress are the real signals. De-emphasize precise time tracking.
- **Deadlines are commitments, not suggestions.** The manager dislikes deadlines being moved. The system should keep deadlines stable, make any change explicit and accountable (original vs current, count of changes), and **alert early when a deadline is at risk** rather than quietly extending it.
- **No idle time.** Every member should be meaningfully utilized. "Utilization" here means *engaged and progressing* (has active work, submitting, moving items forward) — not hours-vs-capacity. Surface idle members: no active work item, submitted with no progress, or fully blocked.

| # | Decision |
|---|----------|
| Tenancy | Single team, one manager (unchanged). |
| Auth | Keep username/password model (no SSO). Still must fix plaintext storage/display + add login rate limiting. |
| Platform | Mostly desktop; **must work well on phone browsers**. No offline requirement. |
| Progress verification | Per work item: **required "what changed since yesterday"** + **screenshot attachments** + **file/link attachments**. (No % slider, no manager "no progress" flag for now.) |
| Commitments loop | Every submission **requires a next-step promise** — **both daily and weekly** (weekly on first submission of the week). Each promise links to a **work item or project**, or is tagged **Other Work** for ad-hoc tasks. Next working day the app **follows up** (Done/Partial/Not done/Carried); missed daily promises **auto-carry with a carry count**. Drives a **Commitment Reliability %** and repeated-carry escalation. |
| Working week | **Monday–Saturday** (Sunday off). Drives weekend-aware follow-up, weekly promises, and any working-day calculations. |
| Hours field | **Kept but optional and de-emphasized** (weak signal; output is primary). |
| Work item ownership | Both manager and employees create; manager can assign to any member(s); **multiple assignees** allowed. |
| Dependencies | Work items can **depend on** other work items (cross-member handoffs); downstream is **Waiting → Ready** when upstream is Done. |
| Done handling | Employee's **Done counts immediately; manager can reopen** if unsatisfied. |
| Data migration | **Keep current employees + projects; wipe only old daily entries/tasks** and start the new model clean. |
| Submission | **One update per day, editable until end of day, then locked** (replaces the old submit-once/edit-once rule). |
| Visibility | Employee sees **own work + status of upstream items they depend on** (for handoffs); not the whole team. |
| Work item status | User-friendly set: **Not started → In progress → Blocked → Done**, with auto **Waiting/Ready** for dependencies. Keep it simple. |
| Work item deadline | **Optional** per item; rolls up to the project timeline. |
| Leave / holiday | **Company holiday calendar + employee leave marking**; excluded from reliability & idle metrics. |
| Commit granularity | **A promise per active work item (daily) + one overall weekly promise.** |
| Evidence | Screenshots **optional by default**; manager can mark a work item **"evidence required."** |
| Manager account | Manager can **change own password + reset employee passwords in-app.** |
| Design | Match the look & feel of **merilacademy.global** (capture exact colors/typography via screenshots at UI time); keep Meril branding. |
| Audit log | **Yes** — record who changed what and when. |
| Stack | **Stay on Next.js + Supabase + Vercel.** |
| Team size | **~10 members** now; small growth expected. |
| Active projects | **5–6** at a time. |
| Report audience | **Manager only** (no separate stakeholder group for now). |
| Email | **Deferred** — build email automation only after the app is fully functional. Use **in-app** signals until then. |
| Hosting | **Vercel + Supabase free tier.** Design within free limits (esp. Supabase Storage ≈1 GB → compress/limit screenshots; Vercel cron limited → reinforces deferring email). |
| Timezone | **IST (UTC+5:30)** for all dates, end-of-day lock, and schedules. |
| Retention | Keep all data **indefinitely**. |
| Quality bar | **Audit log + automated tests + CI.** |
| Build order | **Phase 0 → Phase 1**, shipped **incrementally** (test each with the team). |
| Output vs time | Track task **completion/progress** as the primary signal; hours are secondary/optional. |
| Deadlines | Keep stable; show **original vs current** and change count; require a reason on change; **at-risk alerts** based on remaining progress vs time. Avoid frictionless "extend." |
| Utilization | **Engagement/idle model**, not hours-vs-capacity: who has active work, who's progressing, who's idle or blocked. |
| Email | **Reminder** to employees who haven't submitted; **daily digest to manager** (what each member did today, incl. blockers); **weekly per-member summary to manager**. Manager prefers email over logging in. |
| Zoho Projects | **Deferred to next version (§16).** Design the data model to be Zoho-ready (stable work-item ids, mappable status), but ship no Zoho code this version. |

### 13.1 Key model change — persistent Work Items
Today, each daily entry stores free-text tasks with no continuity between days. To support progress verification and Zoho task mapping, introduce a **Work Item** that persists across days:
- A work item belongs to a project — or is tagged **Other Work** for ad-hoc tasks outside any project — and (optionally) a Zoho task id.
- **Assignees:** one or more members (single-owner or shared across a project).
- **Ownership:** both manager and employees can create work items; the manager can assign to any member(s).
- **Dependencies / handoffs:** a work item can depend on another. The downstream item is **Waiting** until the upstream is **Done**, then flips to **Ready to start** and notifies its assignee. Dependency waiting auto-clears on completion (no manual blocker). Manager sees the chain and where a handoff is stuck.
- A daily update logs progress *against* a work item: optional hours, status, **what changed since yesterday**, attachments (screenshots/files/links).
- The manager sees a per-work-item **timeline** of daily progress + screenshots — making real change (or its absence) visible.
This is the enabling change for §14 Phases 1–3.

### 13.2 Commitments — the promise → follow-up → delivered loop
Accountability comes from comparing what a member *promised* to what they *delivered*.

**Daily flow becomes 3 steps:**
1. **Follow up** — app shows yesterday's open promises; employee marks each `done | partial | missed | carried` (+ note + optional screenshot). This is the structured "what changed."
2. **Log** — any other progress today.
3. **Commit** — required "what will you accomplish tomorrow?"; on the first submission of the week, also "what this week?". Each promise links to a **work item / project** or is tagged **Other Work**.

**Data model — `commitments`:** id, employee_id, work_item_id (nullable), horizon (`day` | `week`), text, due_date (the working day / week it's checked), created_in_entry_id, status (`open | done | partial | missed | carried`), outcome_note, resolved_in_entry_id, resolved_at, carry_count.

**Rules & signals:**
- Working week is **Mon–Sat**; follow-up is weekend/holiday-aware (Saturday's daily promise is followed up Monday).
- **Commitment Reliability %** = delivered (done) ÷ promised, per employee per period — a headline manager metric.
- A promise **carried 3+ times** is escalated to the manager as stalled work.
- Missed promises can optionally link to a blocker.

### 13.3 v1 (Monday) — first live version scope
Delivery target: **live by Monday** for the team to start using. Built **on the existing entry/task model** (no risky refactor) so it's functional and safe on live data. Sequence after: **email → Zoho → enterprise-grade**.

**In scope for v1 (must be fully functional):**
- **Commitments loop** — daily promise ("what will you do tomorrow?") + weekly promise, each linked to a project/task; **next-working-day / next-week follow-up** (Done / Partial / Missed / Carried); auto-carry with count; **Commitment Reliability %**.
- **"What changed since yesterday"** field on each task.
- **Screenshots + file/link attachments** per task/update (Supabase Storage; size-limited + compressed to respect free-tier ~1 GB).
- **Manager views:** per-member **promise-vs-delivered** + Reliability %, and a **daily progress trail with screenshots**; existing Today / Blockers / Projects / History / Settings retained.
- Keep current **employees + projects**; wipe old daily entries for a clean start.
- Mobile-friendly; **IST** throughout.

**Deferred (post-Monday, in order):**
1. **Email** automation (reminders, daily digest, weekly summary).
2. **Zoho Projects** integration (§16).
3. **Enterprise-grade:** formal **Work Items** + cross-member **dependencies/handoffs**, **leave/holiday calendar**, **deadline integrity** + **engagement/idle** analytics, **audit log**, **tests + CI**, **merilacademy.global redesign**, and **security hardening** (password hashing, login rate limiting).

**Accepted tradeoff:** v1 stores commitments against the current project/task. When Work Items land later, commitments migrate to reference `work_item_id` — a known, contained migration.

## 14. Proposed phased roadmap

### Phase 0 — Foundations & hygiene (low risk)
- Hash passwords (or migrate to Supabase Auth for employees); stop displaying plaintext in Settings.
- Rate limiting + lockout on `/api/auth/login`; basic security headers.
- Repo cleanup: remove legacy root HTML prototypes; single canonical schema.
- Mobile-responsive pass across employee + manager views.

### Phase 1 — Progress verification + commitments (core differentiator)
- Introduce **Work Items** (new schema; wipe old free-text task data). Multiple assignees; created by manager or employees; manager can assign.
- **Dependencies / handoffs:** Waiting → Ready transitions when an upstream item is Done.
- **Commitments loop:** 3-step daily flow (follow up → log → commit); daily + weekly promises (Mon–Sat week); auto-carry with count; **Commitment Reliability %**; repeated-carry escalation.
- Per daily update: required "what changed since yesterday", screenshot upload, file/link attachments (Supabase Storage). One update/day, editable until EOD then locked.
- Manager views: per-work-item **timeline** (side-by-side screenshots), **promise-vs-delivered** per member, and **dependency chain / stuck-handoff** visibility.

### Phase 2 — Output, deadlines & engagement
- **Deadline integrity:** store original deadline, surface original-vs-current + change count, require a reason on change, and show **at-risk** status (progress vs time remaining).
- **Engagement/idle view:** who has active work items, who's progressing, who's idle or blocked — the manager's "is everyone utilized?" answer.
- **Output-first reporting:** completions and progress as the headline metrics; hours secondary.

### Phase 3 — Email & stakeholder reporting (manager convenience)
- Scheduled jobs (Vercel Cron) + email provider (e.g., Resend).
- Daily reminder to non-submitters; **daily manager digest** (what each member did today + blockers); **weekly per-member summary**.
- Stakeholder view/report: project timelines vs estimated deadlines, team engagement summary.

### 14.1 Research-driven additions (from `docs/competitive-research.md`, 2026-07-04)
Derived from surveying the async check-in / accountability layer (Geekbot, DailyBot, Standuply, Range, 15Five, Weekdone) and 2026 best-practice research on outcome-based vs surveillance-style tracking. Ranked by value-to-effort; slotted into the phases above.

| # | Addition | Source pattern | Phase | Notes |
|---|----------|----------------|-------|-------|
| 1 | **Auto blocker detection** on the "what changed since yesterday" field | Geekbot / DailyBot flag blocker language in free text | Phase 1 | Heuristic/keyword pass; feeds the existing Blockers tab without requiring explicit tagging. Low effort. |
| 2 | **Employee-facing reliability + streak view** — each person sees their own Commitment Reliability % and submission streak | Employee-facing dashboards drive self-correction better than manager-only reporting | Phase 1 (extend §13.2) | Cheapest lever for the ≥90% submission-rate metric (§11). |
| 3 | **Nudge + deadline mechanic** as a first-class feature (in-app before email) | Standuply: reminders + a deadline are what stop teams missing days | Phase 1→3 | In-app follow-up now; email nudge in Phase 3. |
| 4 | **Reframe engagement/idle view** around *blocked / waiting-on-handoff / stalled*, not idleness | Outcome-based research: "catch the idler" framing drives attrition; "unblock people" framing improves performance | Phase 2 | Same data (§13, utilization), safer + more effective framing. Design decision, ~no extra cost. |
| 5 | **Manager daily digest as an assembled in-app object** (team did X today + blockers) | DailyBot auto-compiled daily summary | Phase 2 (render) → Phase 3 (email) | Build the digest object in-app first so email is a trivial add later. |

**Cross-cutting principle (validates §13):** measure output and framing matters more than the metric. Show reliability to employees, keep hours optional/de-emphasized, and never add activity-surveillance (screen capture, idle timers, keystroke counts) — the research ties those to trust erosion and top-performer attrition.

## 15. Open items to resolve next
1. **Attachments:** confirm storing screenshots/work files in Supabase Storage is acceptable for internal data; set size/type limits and retention.
2. **Idle detection thresholds:** what counts as "idle"? (e.g., no active work item, or a submission with no `what-changed`/progress for N days.) Define the rule the engagement view uses.
3. **At-risk deadline rule:** what triggers an at-risk flag? (e.g., open work items on the project with < X days left and no recent progress.)
4. **Hours field:** keep the optional hours input (light signal) or drop it entirely, given output-over-time?

## 16. Next version — Zoho Projects integration (out of scope for v6)
Built after the tracker is proven internally. Planned then:
- Feasibility spike: Zoho OAuth, API scopes, mapping tracker projects/work items → Zoho projects/tasks.
- One-way push: status & % progress, daily progress notes as task comments, create/update Zoho tasks.
- Mapping/config UI + sync status & error handling.

**v6 constraint:** keep the data model Zoho-ready — stable work-item identifiers and a status enum that maps cleanly to Zoho — so this integration is additive, not a rewrite.

---

*Prepared from a full read of the codebase (Next.js app in `app/`, Supabase schema, and `proxy.ts`). Reflects deployed state at commit `77be45c` (v5.x) plus v6 target decisions from the 2026-07-04 brainstorming.*
