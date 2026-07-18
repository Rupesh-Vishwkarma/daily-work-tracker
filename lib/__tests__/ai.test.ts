import { describe, it, expect } from 'vitest'
import { toAiInput } from '../ai'
import type { WeeklySummaryPayload } from '../types'

const payload: WeeklySummaryPayload = {
  week_start: '2026-07-13',
  week_end: '2026-07-18',
  team: {
    working_days: 6, members: 2, submission_rate: 75,
    commitments_completed: 3, commitments_carried: 1,
    on_time_delivery_pct: 67, open_blockers: 1,
  },
  attention: [{ kind: 'blocker', employee_name: 'Asha', detail: '1 unresolved blocker at week end' }],
  employees: [{
    employee_id: 'asha', employee_name: 'Asha',
    days_submitted: 5, absences: 1,
    tasks_completed: 4, tasks_in_progress: 2, tasks_blocked: 1,
    commitments_delivered: 3, commitments_carried: 1,
    weekly_commitment_outcome: 'completed',
    projects: [{
      project_name: 'XR Trainer',
      tasks: [{ title: 'Build lobby', what_changed: 'finished UI', status: 'completed' }],
      blockers: ['waiting on API key'],
    }],
  }],
}

// Simulate the stored payload later growing extra fields (e.g. a future dev adds
// outcome notes to it). The sanitizer must strip anything not allowlisted.
const polluted = {
  ...payload,
  manager_notes: 'secret note',
  employees: [{
    ...payload.employees[0],
    password: 'hunter2',
    outcome_note: 'private',
    absence_note: 'sick leave',
  }],
} as unknown as WeeklySummaryPayload

describe('toAiInput (spec §4a data boundary)', () => {
  it('preserves all allowlisted data', () => {
    const ai = toAiInput(payload)
    expect(ai).toEqual(payload)
  })

  it('strips any non-allowlisted key, even if the payload grows one', () => {
    const ai = toAiInput(polluted) as unknown as Record<string, unknown>
    expect(ai).not.toHaveProperty('manager_notes')
    const emp = (ai.employees as Record<string, unknown>[])[0]
    expect(emp).not.toHaveProperty('password')
    expect(emp).not.toHaveProperty('outcome_note')
    expect(emp).not.toHaveProperty('absence_note')
  })

  it('never contains denylisted key names anywhere in the serialized output', () => {
    const json = JSON.stringify(toAiInput(polluted)).toLowerCase()
    for (const banned of ['password', 'outcome_note', 'absence_note', 'broadcast', 'comment']) {
      expect(json).not.toContain(banned)
    }
  })
})
