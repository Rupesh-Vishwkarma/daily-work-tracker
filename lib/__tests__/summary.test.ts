import { describe, it, expect } from 'vitest'
import { summarize, weekBoundsFor } from '../summary'
import type { Entry, Commitment } from '../types'

const WEEK = { start: '2026-07-13', end: '2026-07-18', workingDays: 6 } // Mon–Sat

const roster = [
  { id: 'manager', name: 'Shorya', role: 'manager' },
  { id: 'asha', name: 'Asha', role: 'employee' },
  { id: 'ravi', name: 'Ravi', role: 'employee' },
]

const projects = [{ id: 'proj-xr', name: 'XR Trainer' }]

function entry(over: Partial<Entry>): Entry {
  return {
    id: 'e1', employee_id: 'asha', employee_name: 'Asha', date: '2026-07-13',
    workload: 'medium', timestamp: '', submit_count: 1, is_absent: false,
    submitted_by_manager: false, project_tasks: [], ...over,
  }
}

function commitment(over: Partial<Commitment>): Commitment {
  return {
    id: 'c1', employee_id: 'asha', employee_name: 'Asha', project_id: 'proj-xr',
    horizon: 'day', text: 'ship it', due_date: '2026-07-14',
    created_in_entry_id: null, status: 'done', outcome_note: null,
    resolved_at: null, carry_count: 0, created_at: '', ...over,
  }
}

describe('summarize', () => {
  it('excludes the manager from members and briefs', () => {
    const p = summarize(WEEK.start, WEEK.end, WEEK.workingDays, roster,
      [entry({ employee_id: 'manager', employee_name: 'Shorya' })], [], projects, new Set())
    expect(p.team.members).toBe(2)
    expect(p.employees.map(e => e.employee_id)).toEqual(['asha', 'ravi'])
    expect(p.employees.every(e => e.employee_id !== 'manager')).toBe(true)
  })

  it('groups tasks project-wise with title, what_changed, status', () => {
    const e = entry({
      project_tasks: [
        { project_id: 'proj-xr', task: 'Build lobby', time: '3', status: 'completed', blockers: '', what_changed: 'finished UI' },
        { project_id: '', task: 'Team docs', time: '', status: 'in_progress', blockers: '', what_changed: 'drafted' },
      ],
    })
    const p = summarize(WEEK.start, WEEK.end, WEEK.workingDays, roster, [e], [], projects, new Set())
    const asha = p.employees.find(x => x.employee_id === 'asha')!
    expect(asha.tasks_completed).toBe(1)
    expect(asha.tasks_in_progress).toBe(1)
    expect(asha.projects.map(pr => pr.project_name).sort()).toEqual(['Other Work', 'XR Trainer'])
    const xr = asha.projects.find(pr => pr.project_name === 'XR Trainer')!
    expect(xr.tasks[0]).toEqual({ title: 'Build lobby', what_changed: 'finished UI', status: 'completed' })
  })

  it('counts unresolved blockers and skips resolved ones', () => {
    const e = entry({
      id: 'e9',
      project_tasks: [
        { project_id: 'proj-xr', task: 'A', time: '', status: 'blocked', blockers: 'waiting on API key', what_changed: 'stuck' },
        { project_id: 'proj-xr', task: 'B', time: '', status: 'blocked', blockers: 'no device', what_changed: 'stuck' },
      ],
    })
    const p = summarize(WEEK.start, WEEK.end, WEEK.workingDays, roster, [e], [], projects, new Set(['e9:1']))
    expect(p.team.open_blockers).toBe(1)
    const asha = p.employees.find(x => x.employee_id === 'asha')!
    expect(asha.projects[0].blockers).toEqual(['waiting on API key'])
    expect(p.attention.some(a => a.kind === 'blocker' && a.employee_name === 'Asha')).toBe(true)
  })

  it('computes commitment stats and on-time %', () => {
    const cs = [
      commitment({ id: 'c1', status: 'done', carry_count: 0 }),
      commitment({ id: 'c2', status: 'done', carry_count: 2 }),
      commitment({ id: 'c3', status: 'open', carry_count: 3 }),
      commitment({ id: 'c4', employee_id: 'manager', status: 'done' }), // must be ignored
    ]
    const p = summarize(WEEK.start, WEEK.end, WEEK.workingDays, roster, [entry({})], cs, projects, new Set())
    expect(p.team.commitments_completed).toBe(2)
    expect(p.team.commitments_carried).toBe(1)
    expect(p.team.on_time_delivery_pct).toBe(50)
    expect(p.attention.some(a => a.kind === 'stalled')).toBe(true)
  })

  it('on_time_delivery_pct is null with zero completed', () => {
    const p = summarize(WEEK.start, WEEK.end, WEEK.workingDays, roster, [], [], projects, new Set())
    expect(p.team.on_time_delivery_pct).toBeNull()
  })

  it('flags zero-activity and missed-days employees', () => {
    // asha submits once; ravi is fully silent
    const p = summarize(WEEK.start, WEEK.end, WEEK.workingDays, roster, [entry({})], [], projects, new Set())
    expect(p.attention.some(a => a.kind === 'zero_activity' && a.employee_name === 'Ravi')).toBe(true)
    expect(p.attention.some(a => a.kind === 'missed_days' && a.employee_name === 'Asha')).toBe(true)
    // zero-activity employees still get a brief
    expect(p.employees.find(e => e.employee_id === 'ravi')!.days_submitted).toBe(0)
  })

  it('computes submission rate from non-absent entries only', () => {
    const es = [
      entry({ id: 'a1', date: '2026-07-13' }),
      entry({ id: 'a2', date: '2026-07-14', is_absent: true }),
    ]
    const p = summarize(WEEK.start, WEEK.end, WEEK.workingDays, roster, es, [], projects, new Set())
    // 1 submission / (2 members × 6 days) = 8%
    expect(p.team.submission_rate).toBe(8)
    expect(p.employees.find(e => e.employee_id === 'asha')!.absences).toBe(1)
  })

  it('weekly commitment outcome: done beats open beats none', () => {
    const cs = [commitment({ id: 'w1', horizon: 'week', status: 'open', due_date: '2026-07-18' })]
    const p = summarize(WEEK.start, WEEK.end, WEEK.workingDays, roster, [], cs, projects, new Set())
    expect(p.employees.find(e => e.employee_id === 'asha')!.weekly_commitment_outcome).toBe('carried')
    expect(p.employees.find(e => e.employee_id === 'ravi')!.weekly_commitment_outcome).toBe('none')
  })
})

describe('weekBoundsFor', () => {
  it('resolves a Sunday to the just-finished Mon–Sat week', () => {
    // 2026-07-19 is a Sunday
    expect(weekBoundsFor('2026-07-19')).toEqual({ weekStart: '2026-07-13', weekEnd: '2026-07-18', workingDays: 6 })
  })

  it('resolves a mid-week day to the current week', () => {
    // 2026-07-15 is a Wednesday
    expect(weekBoundsFor('2026-07-15')).toEqual({ weekStart: '2026-07-13', weekEnd: '2026-07-18', workingDays: 6 })
  })
})
