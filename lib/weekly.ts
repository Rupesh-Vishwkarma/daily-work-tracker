import { supabaseAdmin } from './supabase'
import { summarize, weekBoundsFor, type RosterMember, type ProjectName } from './summary'
import { sendWeeklyEmail, RECIPIENTS } from './email'
import type { Entry, Commitment, WeeklySummary, WeeklySummaryPayload } from './types'

/** Fetches the week's data and aggregates. Data boundary (spec §4a): queries ONLY
 *  entries, commitments, projects, resolved_blockers, and employees(id,name,role).
 *  Never selects password; never touches comments or broadcast. */
export async function generateWeeklySummary(weekStart: string, weekEnd: string, workingDays: number): Promise<WeeklySummaryPayload> {
  const admin = supabaseAdmin()
  const [roster, entries, commitments, projects, resolved] = await Promise.all([
    admin.from('employees').select('id, name, role'),
    admin.from('entries').select('*').gte('date', weekStart).lte('date', weekEnd),
    admin.from('commitments').select('*').gte('due_date', weekStart).lte('due_date', weekEnd),
    admin.from('projects').select('id, name'),
    admin.from('resolved_blockers').select('key'),
  ])
  for (const r of [roster, entries, commitments, projects, resolved]) {
    if (r.error) throw new Error(r.error.message)
  }
  return summarize(
    weekStart, weekEnd, workingDays,
    (roster.data || []) as RosterMember[],
    (entries.data || []) as Entry[],
    (commitments.data || []) as Commitment[],
    (projects.data || []) as ProjectName[],
    new Set(((resolved.data || []) as { key: string }[]).map(r => r.key)),
  )
}

/** Build the deterministic payload and upsert the week's row (no email). Idempotent:
 *  keyed on week_start, so regeneration updates in place. */
export async function generateAndStore(targetDate: string): Promise<WeeklySummary> {
  const { weekStart, weekEnd, workingDays } = weekBoundsFor(targetDate)
  const payload = await generateWeeklySummary(weekStart, weekEnd, workingDays)
  const admin = supabaseAdmin()
  const { data, error } = await admin.from('weekly_summaries')
    .upsert(
      { week_start: weekStart, week_end: weekEnd, payload, narrative: null, generated_at: new Date().toISOString() },
      { onConflict: 'week_start' },
    )
    .select().single()
  if (error) throw new Error(error.message)
  return data as WeeklySummary
}

/** Send the week's summary email (generating first if missing) and record the
 *  outcome on the row. Never throws for a send failure — it records send_error. */
export async function sendWeek(targetDate: string): Promise<WeeklySummary> {
  const { weekStart } = weekBoundsFor(targetDate)
  const admin = supabaseAdmin()
  const { data: existing } = await admin.from('weekly_summaries')
    .select('*').eq('week_start', weekStart).maybeSingle()
  const row = (existing as WeeklySummary | null) ?? await generateAndStore(targetDate)

  const result = await sendWeeklyEmail(row.payload)
  const updates = result.ok
    ? { sent_at: new Date().toISOString(), sent_to: [RECIPIENTS.to, RECIPIENTS.cc], send_error: null }
    : { send_error: result.error }
  const { data, error } = await admin.from('weekly_summaries')
    .update(updates).eq('week_start', weekStart).select().single()
  if (error) throw new Error(error.message)
  return data as WeeklySummary
}
