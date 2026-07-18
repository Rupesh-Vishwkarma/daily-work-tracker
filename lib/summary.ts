// Pure aggregation module — no DB imports, so it stays unit-testable (spec §4).
import { weekMonday, weekSaturday, workingDaysBetween, isWorkingDay } from './dates'
import type {
  Entry, Commitment, WeeklySummaryPayload, EmployeeBrief, AttentionItem, ProjectWork,
} from './types'

export interface RosterMember { id: string; name: string; role: string }
export interface ProjectName { id: string; name: string }

const STALLED_CARRIES = 3

/** Pure aggregation — spec §4/§4.1. No DB access; fully unit-tested. */
export function summarize(
  weekStart: string,
  weekEnd: string,
  workingDays: number,
  roster: RosterMember[],
  allEntries: Entry[],
  allCommitments: Commitment[],
  projects: ProjectName[],
  resolvedBlockerKeys: Set<string>,
): WeeklySummaryPayload {
  // Manager is excluded entirely (spec §4.1) — from roster, entries, and commitments.
  const team = roster.filter(m => m.role !== 'manager' && m.id !== 'manager')
  const teamIds = new Set(team.map(m => m.id))
  const entries = allEntries.filter(e => teamIds.has(e.employee_id))
  const commitments = allCommitments.filter(c => teamIds.has(c.employee_id))

  const projectNames = new Map(projects.map(p => [p.id, p.name]))
  const attention: AttentionItem[] = []
  let totalSubmitted = 0
  let openBlockers = 0

  const briefs: EmployeeBrief[] = team.map(member => {
    const mine = entries.filter(e => e.employee_id === member.id)
    const submitted = mine.filter(e => !e.is_absent)
    totalSubmitted += submitted.length

    let completed = 0, inProgress = 0, blocked = 0, myBlockers = 0
    const byProject = new Map<string, ProjectWork>()

    for (const e of submitted) {
      ;(e.project_tasks || []).forEach((t, i) => {
        if (!t.task?.trim()) return
        if (t.status === 'completed') completed++
        else if (t.status === 'blocked') blocked++
        else inProgress++

        const pid = t.project_id || '__other__'
        let work = byProject.get(pid)
        if (!work) {
          work = { project_name: projectNames.get(pid) || 'Other Work', tasks: [], blockers: [] }
          byProject.set(pid, work)
        }
        work.tasks.push({ title: t.task.trim(), what_changed: t.what_changed?.trim() || '', status: t.status })

        const hasBlocker = t.status === 'blocked' || !!t.blockers?.trim()
        if (hasBlocker && !resolvedBlockerKeys.has(`${e.id}:${i}`)) {
          openBlockers++
          myBlockers++
          if (t.blockers?.trim()) work.blockers.push(t.blockers.trim())
        }
      })
    }

    const mineC = commitments.filter(c => c.employee_id === member.id)
    const delivered = mineC.filter(c => c.status === 'done').length
    const carried = mineC.filter(c => c.status === 'open').length
    const weekly = mineC.filter(c => c.horizon === 'week')
    const weekly_commitment_outcome: EmployeeBrief['weekly_commitment_outcome'] =
      weekly.some(c => c.status === 'done') ? 'completed'
      : weekly.some(c => c.status === 'open') ? 'carried'
      : 'none'

    const stalled = mineC.filter(c => c.status === 'open' && c.carry_count >= STALLED_CARRIES).length
    if (submitted.length === 0 && mineC.length === 0) {
      attention.push({ kind: 'zero_activity', employee_name: member.name, detail: `No updates or commitments all week (0/${workingDays} days)` })
    } else if (submitted.length < workingDays - 1) {
      attention.push({ kind: 'missed_days', employee_name: member.name, detail: `Submitted ${submitted.length}/${workingDays} working days` })
    }
    if (stalled > 0) {
      attention.push({ kind: 'stalled', employee_name: member.name, detail: `${stalled} commitment${stalled > 1 ? 's' : ''} stalled (${STALLED_CARRIES}+ carries)` })
    }
    if (myBlockers > 0) {
      attention.push({ kind: 'blocker', employee_name: member.name, detail: `${myBlockers} unresolved blocker${myBlockers > 1 ? 's' : ''} at week end` })
    }

    return {
      employee_id: member.id,
      employee_name: member.name,
      days_submitted: submitted.length,
      absences: mine.length - submitted.length,
      tasks_completed: completed,
      tasks_in_progress: inProgress,
      tasks_blocked: blocked,
      commitments_delivered: delivered,
      commitments_carried: carried,
      weekly_commitment_outcome,
      projects: [...byProject.values()],
    }
  })

  const done = commitments.filter(c => c.status === 'done')
  const onTime = done.filter(c => (c.carry_count || 0) === 0)

  return {
    week_start: weekStart,
    week_end: weekEnd,
    team: {
      working_days: workingDays,
      members: team.length,
      submission_rate: team.length && workingDays
        ? Math.round((totalSubmitted / (team.length * workingDays)) * 100) : 0,
      commitments_completed: done.length,
      commitments_carried: commitments.filter(c => c.status === 'open').length,
      on_time_delivery_pct: done.length ? Math.round((onTime.length / done.length) * 100) : null,
      open_blockers: openBlockers,
    },
    attention,
    employees: briefs,
  }
}

/** Week bounds for a target IST date. On Sunday, dates.ts helpers resolve to the
 *  just-finished Mon–Sat week — exactly what the Sunday cron needs. */
export function weekBoundsFor(date: string): { weekStart: string; weekEnd: string; workingDays: number } {
  const weekStart = weekMonday(date)
  const weekEnd = weekSaturday(date)
  const workingDays = workingDaysBetween(weekStart, weekEnd) + (isWorkingDay(weekStart) ? 1 : 0)
  return { weekStart, weekEnd, workingDays }
}

