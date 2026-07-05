// Seed realistic test data into Supabase for local/demo testing.
// All rows use ids prefixed with "seed-" so clear-test-data.mjs can remove them cleanly.
// Run:  node --env-file=.env.local scripts/seed-test-data.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing Supabase env vars'); process.exit(1) }
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const EMPLOYEES = [
  { id: 'ashok', name: 'Ashok' },
  { id: 'devdesai', name: 'Dev Desai' },
  { id: 'devparekh', name: 'Dev Parekh' },
  { id: 'karan', name: 'Karan Patel' },
  { id: 'mampi', name: 'Mampi' },
  { id: 'narendra', name: 'Narendra Shukla' },
  { id: 'prem', name: 'Prem Sagar' },
  { id: 'rupesh', name: 'Rupesh Vishwkarma' },
]

const PROJECTS = [
  'scrcpy-casting', 'gap-check-app', 'halo', 'parallax-screen',
  'merilverse', 'portal-world-mizzo-orion', 'obtura-simulator',
]

// Mon–Sat working days across the last two weeks (IST).
const WORK_DAYS = [
  '2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27',
  '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04',
]
const SATURDAYS = ['2026-06-27', '2026-07-04']

const TASKS = {
  'scrcpy-casting': ['Fix Android mirroring latency', 'Add multi-device casting', 'Debug ADB connection drops', 'Optimize H.264 decode pipeline'],
  'gap-check-app': ['Build gap-analysis report screen', 'Wire up form validation', 'Integrate checklist REST API', 'Fix offline sync conflict'],
  'halo': ['Calibrate HALO headset tracking', 'Reduce render frame drops', 'Implement hand-gesture menu', 'Fix IPD adjustment bug'],
  'parallax-screen': ['Tune parallax depth shader', 'Add head-tracking smoothing', 'Fix z-fighting on layers', 'Benchmark GPU usage'],
  'merilverse': ['Design avatar loadout UI', 'Optimize world streaming', 'Add spatial audio zones', 'Fix teleport collision'],
  'portal-world-mizzo-orion': ['Integrate Mizzo Orion SDK', 'Build portal transition VFX', 'Fix lightmap baking', 'Add portal save/load'],
  'obtura-simulator': ['Model surgical tool physics', 'Add haptic feedback loop', 'Fix camera clipping in OR', 'Tune tissue deformation'],
}
const WHAT_CHANGED = [
  'Completed initial implementation and pushed to branch.',
  'Reviewed feedback and refactored the module.',
  'Made progress but hit a rendering edge case.',
  'Wrapped up testing, ready for QA.',
  'Started integration, roughly 60% done.',
  'Fixed the regression from yesterday and added a test.',
]
const BLOCKERS = [
  'Waiting on hardware from vendor.',
  'API credentials not provisioned yet.',
  'Dependent PR not merged.',
  'Need design assets from UX.',
]
const COMMIT_TEXT = [
  'Ship the casting latency fix', 'Finish gap-check report screen', 'Complete HALO calibration pass',
  'Deliver parallax shader tuning', 'Demo Merilverse avatar UI', 'Integrate Mizzo Orion SDK',
  'Finalize Obtura haptics prototype', 'Close out offline-sync bug',
]
const OUTCOMES = {
  done: ['Delivered and merged.', 'Shipped, verified in staging.', 'Done — demoed to team.'],
  partial: ['Most of it done, one edge case pending.', 'Core work done, polish remaining.'],
  missed: ['Blocked by dependency, could not finish.', 'Ran out of time, carrying over.'],
}

// Tiny seeded PRNG so re-runs are deterministic.
let _s = 42
const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff }
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const pickN = (arr, n) => { const c = [...arr]; const out = []; while (out.length < n && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return out }

const entries = []
const commitments = []

EMPLOYEES.forEach((emp, ei) => {
  // Each employee submits most working days; skip ~1 and mark ~1 absent.
  const skip = new Set([pick(WORK_DAYS)])
  const absent = new Set([pick(WORK_DAYS.filter(d => !skip.has(d)))])

  WORK_DAYS.forEach((date) => {
    if (skip.has(date)) return
    const id = `seed-e-${emp.id}-${date}`
    if (absent.has(date)) {
      entries.push({ id, employee_id: emp.id, employee_name: emp.name, date, workload: 'light', project_tasks: [], is_absent: true, submitted_by_manager: false, submit_count: 1, timestamp: `${date}T12:30:00.000Z` })
      return
    }
    const nTasks = 1 + Math.floor(rnd() * 3)
    const projs = pickN(PROJECTS, nTasks)
    const tasks = projs.map((pid, i) => {
      const blocked = rnd() < 0.18
      return {
        project_id: pid,
        task: pick(TASKS[pid]),
        time: `${1 + Math.floor(rnd() * 6)}h`,
        status: blocked ? 'blocked' : (rnd() < 0.5 ? 'completed' : 'in_progress'),
        blockers: blocked ? pick(BLOCKERS) : '',
        what_changed: pick(WHAT_CHANGED),
      }
    })
    const heavy = tasks.length >= 3
    entries.push({
      id, employee_id: emp.id, employee_name: emp.name, date,
      workload: heavy ? 'heavy' : (tasks.length === 2 ? 'medium' : 'light'),
      project_tasks: tasks, is_absent: false, submitted_by_manager: false, submit_count: 1,
      timestamp: `${date}T13:${10 + ei}:00.000Z`,
    })
  })

  // Commitments: reliability varies by employee; a couple stalled carriers.
  const doneBias = 0.45 + (ei % 4) * 0.15 // 0.45 .. 0.9
  const resolvedDays = ['2026-06-24', '2026-06-26', '2026-06-30', '2026-07-02', '2026-07-03']
  resolvedDays.forEach((due, i) => {
    const r = rnd()
    const status = r < doneBias ? 'done' : (r < doneBias + 0.2 ? 'partial' : 'missed')
    commitments.push({
      id: `seed-c-${emp.id}-r${i}`, employee_id: emp.id, employee_name: emp.name,
      project_id: pick(PROJECTS), horizon: i % 3 === 0 ? 'week' : 'day',
      text: pick(COMMIT_TEXT), due_date: due, status,
      outcome_note: pick(OUTCOMES[status]), resolved_at: `${due}T14:00:00.000Z`,
      carry_count: status === 'missed' ? 1 + Math.floor(rnd() * 2) : 0,
      created_at: `${due}T09:00:00.000Z`,
    })
  })
  // One or two currently-open commitments (future-dated so they don't block the submit gate).
  commitments.push({
    id: `seed-c-${emp.id}-open0`, employee_id: emp.id, employee_name: emp.name,
    project_id: pick(PROJECTS), horizon: 'day', text: pick(COMMIT_TEXT),
    due_date: '2026-07-06', status: 'open', outcome_note: null, resolved_at: null,
    carry_count: 0, created_at: '2026-07-04T09:00:00.000Z',
  })
  commitments.push({
    id: `seed-c-${emp.id}-open1`, employee_id: emp.id, employee_name: emp.name,
    project_id: pick(PROJECTS), horizon: 'week', text: pick(COMMIT_TEXT),
    due_date: '2026-07-11', status: 'open', outcome_note: null, resolved_at: null,
    carry_count: 0, created_at: '2026-07-04T09:00:00.000Z',
  })
  // A stalled (3+ carries) open commitment for two employees to populate the "Stalled" metric.
  if (ei % 4 === 0) {
    commitments.push({
      id: `seed-c-${emp.id}-stall`, employee_id: emp.id, employee_name: emp.name,
      project_id: pick(PROJECTS), horizon: 'day', text: pick(COMMIT_TEXT),
      due_date: '2026-07-06', status: 'open', outcome_note: null, resolved_at: null,
      carry_count: 3 + Math.floor(rnd() * 2), created_at: '2026-06-29T09:00:00.000Z',
    })
  }
})

console.log(`Seeding ${entries.length} entries and ${commitments.length} commitments...`)
const e1 = await db.from('entries').upsert(entries).select('id')
if (e1.error) { console.error('entries error:', e1.error.message); process.exit(1) }
const c1 = await db.from('commitments').upsert(commitments).select('id')
if (c1.error) { console.error('commitments error:', c1.error.message); process.exit(1) }
console.log(`Done. Inserted ${e1.data.length} entries, ${c1.data.length} commitments.`)
