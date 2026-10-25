import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WeeklySummaryPayload } from '../types'

type Row = Record<string, unknown>

const { db, sendWeeklyEmail } = vi.hoisted(() => {
  const db: { tables: Record<string, Row[]> } = { tables: {} }

  // Minimal in-memory stand-in for the supabase-js query builder calls weekly.ts makes.
  class Query {
    private filters: ((r: Row) => boolean)[] = []
    private op: 'select' | 'upsert' | 'update' = 'select'
    private values: Row = {}
    constructor(private table: string) {}
    select() { return this }
    gte(c: string, v: string) { this.filters.push(r => String(r[c]) >= v); return this }
    lte(c: string, v: string) { this.filters.push(r => String(r[c]) <= v); return this }
    eq(c: string, v: unknown) { this.filters.push(r => r[c] === v); return this }
    upsert(values: Row) { this.op = 'upsert'; this.values = values; return this }
    update(values: Row) { this.op = 'update'; this.values = values; return this }
    private run(): Row[] {
      const rows = (db.tables[this.table] ??= [])
      if (this.op === 'upsert') {
        const i = rows.findIndex(r => r.week_start === this.values.week_start)
        const merged = { ...(i >= 0 ? rows[i] : {}), ...this.values }
        if (i >= 0) rows[i] = merged; else rows.push(merged)
        return [merged]
      }
      const matched = rows.filter(r => this.filters.every(f => f(r)))
      if (this.op === 'update') matched.forEach(r => Object.assign(r, this.values))
      return matched
    }
    single() { return Promise.resolve({ data: this.run()[0], error: null }) }
    maybeSingle() { return Promise.resolve({ data: this.run()[0] ?? null, error: null }) }
    then<T>(resolve: (v: { data: Row[]; error: null }) => T) { return Promise.resolve({ data: this.run(), error: null }).then(resolve) }
  }

  return {
    db: Object.assign(db, { from: (t: string) => new Query(t) }),
    sendWeeklyEmail: vi.fn(),
  }
})

vi.mock('../supabase', () => ({ supabaseAdmin: () => db }))
vi.mock('../email', () => ({
  sendWeeklyEmail,
  RECIPIENTS: { to: 'manager@example.com', cc: 'cc@example.com' },
}))

import { sendWeek } from '../weekly'

const SUNDAY = '2026-07-19' // resolves to the Mon 13 – Sat 18 July week

function staleSnapshot(): WeeklySummaryPayload {
  return {
    week_start: '2026-07-13', week_end: '2026-07-18',
    team: {
      working_days: 6, members: 1, submission_rate: 0, commitments_completed: 0,
      commitments_carried: 0, on_time_delivery_pct: null, open_blockers: 0,
    },
    attention: [],
    employees: [],
  }
}

beforeEach(() => {
  sendWeeklyEmail.mockReset()
  db.tables = {
    employees: [{ id: 'asha', name: 'Asha', role: 'employee' }],
    entries: [{
      id: 'e1', employee_id: 'asha', date: '2026-07-15', is_absent: false,
      project_tasks: [{ project_id: 'proj-xr', task: 'Build lobby', status: 'completed' }],
    }],
    commitments: [],
    projects: [{ id: 'proj-xr', name: 'XR Trainer' }],
    resolved_blockers: [],
    weekly_summaries: [],
  }
})

describe('sendWeek', () => {
  it('rebuilds from current data instead of sending a stale stored snapshot', async () => {
    db.tables.weekly_summaries.push({
      week_start: '2026-07-13', week_end: '2026-07-18',
      payload: staleSnapshot(), generated_at: '2026-07-13T10:17:00.000Z', sent_at: null,
    })
    sendWeeklyEmail.mockResolvedValue({ ok: true })

    const row = await sendWeek(SUNDAY)

    const sent: WeeklySummaryPayload = sendWeeklyEmail.mock.calls[0][0]
    expect(sent.employees).toHaveLength(1)
    expect(sent.employees[0].days_submitted).toBe(1)
    expect(sent.employees[0].tasks_completed).toBe(1)
    expect(row.payload).toEqual(sent)
    expect(row.generated_at).not.toBe('2026-07-13T10:17:00.000Z')
    expect(row.sent_at).toBeTruthy()
    expect(db.tables.weekly_summaries).toHaveLength(1)
  })

  it('creates the row when none exists and records a send failure', async () => {
    sendWeeklyEmail.mockResolvedValue({ ok: false, error: 'SMTP down' })

    const row = await sendWeek(SUNDAY)

    expect(sendWeeklyEmail).toHaveBeenCalledTimes(1)
    expect(row.payload.employees[0].days_submitted).toBe(1)
    expect(row.sent_at ?? null).toBeNull()
    expect(row.send_error).toBe('SMTP down')
  })
})
