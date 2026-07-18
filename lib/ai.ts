import type { WeeklySummaryPayload, AiInput } from './types'

/**
 * Spec §4a — the hard AI data boundary. Rebuilds a fresh object picking ONLY
 * allowlisted keys, so nothing added to the payload later can reach Gemini
 * without a deliberate change here. The AI never touches the database.
 */
export function toAiInput(payload: WeeklySummaryPayload): AiInput {
  return {
    week_start: payload.week_start,
    week_end: payload.week_end,
    team: {
      working_days: payload.team.working_days,
      members: payload.team.members,
      submission_rate: payload.team.submission_rate,
      commitments_completed: payload.team.commitments_completed,
      commitments_carried: payload.team.commitments_carried,
      on_time_delivery_pct: payload.team.on_time_delivery_pct,
      open_blockers: payload.team.open_blockers,
    },
    attention: payload.attention.map(a => ({
      kind: a.kind, employee_name: a.employee_name, detail: a.detail,
    })),
    employees: payload.employees.map(e => ({
      employee_id: e.employee_id,
      employee_name: e.employee_name,
      days_submitted: e.days_submitted,
      absences: e.absences,
      tasks_completed: e.tasks_completed,
      tasks_in_progress: e.tasks_in_progress,
      tasks_blocked: e.tasks_blocked,
      commitments_delivered: e.commitments_delivered,
      commitments_carried: e.commitments_carried,
      weekly_commitment_outcome: e.weekly_commitment_outcome,
      projects: e.projects.map(p => ({
        project_name: p.project_name,
        tasks: p.tasks.map(t => ({ title: t.title, what_changed: t.what_changed, status: t.status })),
        blockers: [...p.blockers],
      })),
    })),
  }
}

const PROMPT = `You are writing a weekly team update for an engineering manager.
Use ONLY the data in the JSON below — never invent, add, or recompute any figure.
Write in plain factual English, no fluff, no markdown headers. Structure:
1. A 2-3 sentence overview of the team's week.
2. For each employee: a short paragraph summarizing their week PROJECT BY PROJECT,
   using the task titles and what_changed notes given. Mention their blockers if any.
3. If the attention list is non-empty: a short "Needs attention" list; end each item
   with "— review on the dashboard."
If the data shows no activity, say it was a quiet week with no updates logged.

JSON:
`

/** Gemini narrative from the sanitized AiInput. Graceful: returns null on any
 *  failure, timeout, or missing key — the deterministic email still goes out. */
export async function generateNarrative(payload: WeeklySummaryPayload): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  // Model is env-configurable: some keys have 0 free-tier quota for a given model,
  // so this can be pointed at whichever model the key is entitled to.
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT + JSON.stringify(toAiInput(payload)) }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
        }),
        signal: controller.signal,
      },
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[ai] Gemini returned', res.status, detail.slice(0, 500))
      return null
    }
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === 'string' && text.trim() ? text.trim().slice(0, 12000) : null
  } catch (err) {
    console.error('[ai] narrative generation failed:', err)
    return null
  } finally {
    clearTimeout(timer)
  }
}
