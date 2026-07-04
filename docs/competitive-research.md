# Competitive & Best-Practice Research — Team Tracking Tools

| Field | Value |
|-------|-------|
| Purpose | Survey what large organizations use for team tracking, extract what applies to the Meril Daily Work Tracker, and feed concrete additions into the roadmap |
| Scope | Single-manager, ~10-person, output-focused daily tracker (see `PRD.md`) |
| Date | 2026-07-04 |
| Author | Research pass for v6 planning |

---

## 1. Framing: two layers, not one market

"Team tracking" in large companies splits into two layers that solve different problems:

1. **Heavy PPM / portfolio platforms** — Smartsheet, Microsoft Project, Jira, Planview, ServiceNow, Oracle Primavera, Adobe Workfront, Monday.com, Asana, ClickUp. These are governance engines for PMOs, capital programs, and cross-department portfolios. Buyers select on SSO, SOC 2, and linking execution to financials.
2. **Async check-in / accountability layer** — Geekbot, DailyBot, Standuply, Range, 15Five, Lattice, Weekdone. Lightweight daily/weekly check-ins, blocker surfacing, and goal/commitment tracking.

**Our product lives in layer 2.** Layer 1 is explicitly a non-goal (PRD §3: "not a full project/task management tool"). Copying layer-1 features (kanban, sprints, Gantt, dependency graphs, resource-vs-capacity) would contradict the product's own positioning. The useful lessons come almost entirely from layer 2 plus the broader research on outcome-based management.

---

## 2. Landscape summary (layer 1 — context only)

| Tool | Who uses it / niche | Relevance to us |
|------|--------------------|-----------------|
| Smartsheet | ~85% of Fortune 500 (vendor claim); PMOs, regulated industries, capital programs | Low — governance scale we don't need |
| Microsoft Project / 365 | Default where Microsoft infra dominates | Low — ecosystem play |
| Jira (Atlassian) | Standard for Agile software teams | Low — too heavy; but see Zoho-later mapping |
| Planview / Oracle Primavera | Strategic portfolio, engineering/construction | None |
| Monday / Asana / ClickUp | No-code, cross-functional work management | Low — feature bloat relative to our scope |

Takeaway: these validate that the enterprise trend is toward AI-assisted, outcome-linked, integrated work management — but their *form factor* is the opposite of our low-friction daily check-in.

---

## 3. The real reference class (layer 2)

### Geekbot / DailyBot — async standups
- DailyBot's own customer data: **82% of orgs are 1–20 people, 75% have exactly one team** — our exact shape. Standups are 59% of their check-ins; Monday is the busiest day.
- **Auto blocker detection:** recognizes blocker language in free-text responses and surfaces it immediately. Blockers appear in ~2 of 3 responses and are their #1 automation trigger.
- **Auto-compiled daily summary** posted to one channel every working day.

What to take:
- Lightweight blocker detection on the "what changed since yesterday" field so blockers surface without explicit tagging.
- A single assembled "what the team did today + blockers" summary object (renders in-app now; emails later).

### Standuply — accountability / never-miss-a-day
- Core value users cite: **friction-free replies + reminders + a deadline** that keep everyone responsible; teams stop missing days.

What to take:
- Treat the **nudge + deadline** mechanic as a first-class feature. It, more than any dashboard, drives the ≥90% submission-rate metric (PRD §11).

### Range — daily check-ins laddering up to goals
- Purpose-built for distributed teams; **connects daily check-ins to goals/OKRs**, assigns an owner to every goal, shares progress async without extra meetings.
- Lineage of the **Plans / Progress / Problems (PPP)** check-in format.

What to take:
- PPP maps 1:1 onto our 3-step daily flow (Commit / Log / Follow-up) — a proven, low-resistance structure.
- "Managers stay informed without extra meetings" is our positioning; keep it.

### 15Five / Lattice / Weekdone — performance & goals (heavier)
- **The weekly check-in becomes the unit that feeds everything** (reviews draw from months of documented check-ins rather than starting cold).
- Weekdone: lightweight PPP-based weekly OKR check-ins for small teams.

What to take (carefully):
- Design data so a manager could later see a **reliability/output trend over a quarter** — costs nothing now, natural stakeholder report later.
- Do **not** build reviews, 9-box, calibration, or OKR cascades — overkill for 10 people / one manager.

---

## 4. The central lesson: outcome-based, framed as support

Multiple 2026 sources converge, and this is the most actionable finding. It directly backs the manager's operating philosophy in PRD §13 (output over hours, no idle time).

- The industry has shifted from **activity/hours tracking to outcome-based management**. Measure what shipped, what got unblocked, what got decided.
- **Surveillance-style tracking backfires:** correlated with top-performer attrition and "performance theater" (green dots, after-hours pings, mouse-jiggling). Outcome-based approaches show materially lower presenteeism.
- **Employee-facing dashboards beat manager-only reporting** for changing behavior. Roughly half of employees who can see their own data say it made them more productive; they self-correct without manager intervention.
- Monitoring improves performance **only when paired with clear goals and transparent communication** — not on its own.

Implications for our build:
1. The **engagement / "no idle time"** view is the highest-risk feature. Frame it as **blocked / waiting-on-handoff / stalled**, i.e. a tool to *unblock* people — not to catch idlers. Same data, safer and more effective framing.
2. Show **Commitment Reliability % and streaks to the employee**, prominently — not just the manager. Cheapest lever to hit the reliability metric.
3. Keep the **hours field optional and de-emphasized** (already decided). Hours are a valid input metric (estimation), a poor productivity metric.

---

## 5. What NOT to copy

- Kanban boards, sprints, Gantt, full dependency graphs (Jira/Smartsheet). Our Waiting → Ready handoff is the one dependency feature worth having; stop there.
- Deep 75+ tool integrations (Range's selling point). Out of scope; Zoho-later is the right scoped version.
- Bossware / activity monitoring (screen capture, idle timers, keystroke counts). Explicitly avoid — the research says it destroys trust and drives attrition.
- Heavy OKR cascades, 9-box, calibration (15Five/Lattice). Overkill for our size.

---

## 6. Recommended additions (value-to-effort ranked)

1. **Auto blocker detection** on the "what changed" field (Geekbot/DailyBot) → feeds existing Blockers tab. Low effort.
2. **Employee-facing reliability + streak view** — each person sees their own Commitment Reliability % and submission streak. Behavioral self-correction.
3. **Nudge + deadline mechanic** as a first-class feature (in-app before email lands). Drives daily compliance.
4. **Reframe engagement/idle view** around blocked / waiting / stalled-handoff, not idleness.
5. **Manager daily digest as an assembled object** (team did X today + blockers), rendered in-app now so email is a trivial add later.

See `PRD.md` §14 for where these land in the phased roadmap.

---

## 7. Source reliability note

Market-share and statistic figures (e.g. Smartsheet's ~85% Fortune 500, presenteeism percentages, DailyBot's org-size split) come from vendor marketing and analyst blogs — treat as **directional, not authoritative**. The *direction* (enterprise moving to outcome-based, async, accountability-linked check-ins; surveillance backlash) is consistent across independent sources including peer-reviewed work on remote-work monitoring.

### Sources consulted
- Verified Market Research — Top Project Management Software 2026 (market share)
- Work Management Hub — Smartsheet vs Asana 2026 (Fortune 500 penetration)
- Planview ProjectAdvantage (enterprise PPM positioning)
- DailyBot — Async Daily Standups (org-size data, blocker detection)
- Geekbot — Async Standup Meetings (async check-in mechanics)
- Standuply (accountability / reminders + deadline)
- Range — OKR / daily check-in product (goals laddering, PPP)
- 15Five / Lattice / Weekdone (performance & weekly check-in model)
- MDPI — "Digital Panopticon: Remote Work Monitoring" (peer-reviewed; outcome vs process monitoring)
- coommit.com — Outcome-Based Management 2026 (anti-surveillance argument)
- WorkTime — Employee monitoring statistics 2026 (employee-facing dashboards, presenteeism)
