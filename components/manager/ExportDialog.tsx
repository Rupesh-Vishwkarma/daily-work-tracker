'use client'
import React, { useState } from 'react'
import { Entry, Employee, Project, Comment, Commitment } from '@/lib/types'
import { FONT, CARD, BRAND } from '@/lib/ui'
import { todayIST } from '@/lib/dates'

const TODAY = todayIST()

interface ExportData {
  entries: Entry[]
  comments: Comment[]
  commitments: Commitment[]
  reviewed_ids: string[]
  employees: Employee[]
  projects: Project[]
}

function parseHours(t: string) {
  return parseFloat((t || '0').replace(/[^\d.]/g, '')) || 0
}

// CSV-safe: always quote and double up embedded quotes so commas/newlines survive.
function esc(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

function row(cells: unknown[]): string {
  return cells.map(esc).join(',')
}

// Inclusive count of working days (Mon–Sat; Sunday excluded) between two dates.
function workingDaysInclusive(start: string, end: string): number {
  if (!start || !end || start > end) return 0
  let count = 0
  const d = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')
  while (d <= last) {
    if (d.getUTCDay() !== 0) count++
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return count
}

interface Options {
  flags: boolean
  attachments: boolean
  comments: boolean
  commitments: boolean
}

function buildCSV(data: ExportData, opts: Options, periodFrom: string, periodTo: string): string {
  const { entries, comments, commitments, reviewed_ids, employees, projects } = data
  const projName = (id: string) => (id === '__other__' ? 'Other Work' : (projects.find(p => p.id === id)?.name || id || ''))
  const reviewedSet = new Set(reviewed_ids)
  const commentsByEntry: Record<string, Comment[]> = {}
  comments.forEach(c => { (commentsByEntry[c.entry_id] ||= []).push(c) })

  // Which employees appear in scope (keep manager-submitted entries under the employee).
  const empIds = Array.from(new Set(entries.map(e => e.employee_id)))
  const empName = (id: string) => employees.find(e => e.id === id)?.name
    || entries.find(e => e.employee_id === id)?.employee_name
    || id
  empIds.sort((a, b) => empName(a).localeCompare(empName(b)))

  const lines: string[] = []
  lines.push(row(['Team Work Report']))
  lines.push(row(['Generated', new Date().toLocaleString('en-IN')]))
  lines.push(row(['Period', periodFrom ? `${periodFrom} to ${periodTo}` : `All time (through ${periodTo})`]))
  lines.push('')

  // ── Section 1: per-employee appraisal summary ──────────────────────────────
  lines.push(row(['=== EMPLOYEE SUMMARY ===']))
  lines.push(row([
    'Employee', 'Working Days', 'Days Submitted', 'Submission Rate %', 'Absent Days',
    'Total Hours', 'Tasks Logged', 'Tasks Completed', 'Completion Rate %',
    'Heavy Days', 'Medium Days', 'Light Days', 'Blocked Tasks',
    'Commitments', 'Met', 'Missed', 'Partial', 'Open', 'Reliability %',
  ]))
  for (const id of empIds) {
    const emp = entries.filter(e => e.employee_id === id)
    const present = emp.filter(e => !e.is_absent)
    const absent = emp.filter(e => e.is_absent)
    const dates = emp.map(e => e.date).sort()
    const start = periodFrom || dates[0] || periodTo
    const end = periodTo || dates[dates.length - 1] || TODAY
    const workingDays = workingDaysInclusive(start, end)
    const daysSubmitted = new Set(present.map(e => e.date)).size
    const absentDays = new Set(absent.map(e => e.date)).size
    const submissionRate = workingDays > 0 ? Math.round((daysSubmitted / workingDays) * 100) : 0
    const tasks = present.flatMap(e => e.project_tasks || [])
    const totalHours = tasks.reduce((s, t) => s + parseHours(t.time), 0)
    const statused = tasks.filter(t => t.status)
    const completed = statused.filter(t => t.status === 'completed').length
    const completionRate = statused.length ? Math.round((completed / statused.length) * 100) : 0
    const blocked = tasks.filter(t => t.status === 'blocked' || (t.blockers || '').trim()).length
    const heavy = present.filter(e => e.workload === 'heavy').length
    const medium = present.filter(e => e.workload === 'medium').length
    const light = present.filter(e => e.workload === 'light').length

    const cm = commitments.filter(c => c.employee_id === id)
    const met = cm.filter(c => c.status === 'done').length
    const missed = cm.filter(c => c.status === 'missed').length
    const partial = cm.filter(c => c.status === 'partial').length
    const open = cm.filter(c => c.status === 'open').length
    const resolved = met + missed + partial
    const reliability = resolved > 0 ? Math.round((met / resolved) * 100) : ''

    lines.push(row([
      empName(id), workingDays, daysSubmitted, submissionRate, absentDays,
      totalHours, statused.length, completed, completionRate,
      heavy, medium, light, blocked,
      cm.length, met, missed, partial, open, reliability,
    ]))
  }
  lines.push('')

  // ── Section 2: daily task detail ───────────────────────────────────────────
  lines.push(row(['=== DAILY TASK DETAIL ===']))
  const detailHeader: string[] = ['Date', 'Employee', 'Workload']
  if (opts.flags) detailHeader.push('Absent', 'Submitted By Manager', 'Reviewed', 'Submit Count', 'Submitted At')
  detailHeader.push('Project', 'Task', 'What Changed', 'Status', 'Time', 'Blockers')
  if (opts.attachments) detailHeader.push('Attachments')
  lines.push(row(detailHeader))

  const sortedEntries = [...entries].sort((a, b) =>
    a.date.localeCompare(b.date) || empName(a.employee_id).localeCompare(empName(b.employee_id)))
  for (const e of sortedEntries) {
    const tasks = (e.project_tasks || [])
    const base: unknown[] = [e.date, e.employee_name, e.workload]
    const flagCells: unknown[] = opts.flags
      ? [e.is_absent ? 'yes' : 'no', e.submitted_by_manager ? 'yes' : 'no', reviewedSet.has(e.id) ? 'yes' : 'no', e.submit_count, e.timestamp]
      : []
    if (tasks.length === 0) {
      const cells = [...base, ...flagCells, '', '', '', '', '', '']
      if (opts.attachments) cells.push('')
      lines.push(row(cells))
      continue
    }
    for (const t of tasks) {
      const cells: unknown[] = [...base, ...flagCells,
        projName(t.project_id), t.task, t.what_changed || '', t.status, t.time, t.blockers || '']
      if (opts.attachments) {
        const urls = (t.attachments || []).map(a => a.url).filter(Boolean).join(' | ')
        cells.push(urls)
      }
      lines.push(row(cells))
    }
  }
  lines.push('')

  // ── Section 3: commitments ─────────────────────────────────────────────────
  if (opts.commitments) {
    lines.push(row(['=== COMMITMENTS ===']))
    lines.push(row(['Employee', 'Commitment', 'Project', 'Horizon', 'Due Date', 'Status', 'Times Carried', 'Outcome Note', 'Resolved At', 'Created At']))
    for (const c of commitments) {
      lines.push(row([
        c.employee_name, c.text, c.project_id ? projName(c.project_id) : '',
        c.horizon, c.due_date, c.status, c.carry_count || 0,
        c.outcome_note || '', c.resolved_at || '', c.created_at,
      ]))
    }
    lines.push('')
  }

  // ── Section 4: manager comments ────────────────────────────────────────────
  if (opts.comments) {
    lines.push(row(['=== MANAGER COMMENTS ===']))
    lines.push(row(['Entry Date', 'Employee', 'Author', 'Comment', 'Commented At']))
    const entryById: Record<string, Entry> = {}
    entries.forEach(e => { entryById[e.id] = e })
    const sortedComments = [...comments].sort((a, b) => {
      const ea = entryById[a.entry_id]; const eb = entryById[b.entry_id]
      return (ea?.date || '').localeCompare(eb?.date || '') || a.timestamp.localeCompare(b.timestamp)
    })
    for (const c of sortedComments) {
      const e = entryById[c.entry_id]
      lines.push(row([e?.date || '', e?.employee_name || '', c.author, c.text, c.timestamp]))
    }
    lines.push('')
  }

  return lines.join('\n')
}

const btn = (primary: boolean): React.CSSProperties => ({
  padding: '9px 18px', borderRadius: 980, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  fontFamily: FONT, border: primary ? 'none' : '1px solid rgba(0,0,0,0.15)',
  background: primary ? BRAND.navy : 'white', color: primary ? 'white' : '#1D1D1F',
})

export default function ExportDialog({ employees, projects, onClose }: {
  employees: Employee[]; projects: Project[]; onClose: () => void
}) {
  const nonMgr = employees.filter(e => e.role === 'employee')
  const [allTime, setAllTime] = useState(true)
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(TODAY)
  const [empId, setEmpId] = useState('')
  const [opts, setOpts] = useState<Options>({ flags: true, attachments: true, comments: true, commitments: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function toggle(k: keyof Options) {
    setOpts(o => ({ ...o, [k]: !o[k] }))
  }

  async function run() {
    setBusy(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      if (!allTime) { qs.set('from', from); qs.set('to', to) }
      if (empId) qs.set('employee_id', empId)
      const res = await fetch(`/api/export?${qs.toString()}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Export failed (${res.status})`)
      }
      const data: ExportData = await res.json()
      // Prefer the fuller reference data the endpoint returns.
      const merged: ExportData = { ...data, projects: data.projects?.length ? data.projects : projects }
      const csv = buildCSV(merged, opts, allTime ? '' : from, allTime ? TODAY : to)

      const stamp = allTime ? 'all-time' : `${from}_to_${to}`
      const who = empId ? (nonMgr.find(e => e.id === empId)?.name || empId).replace(/\s+/g, '-') : 'team'
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${who}-report_${stamp}.csv`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT }
  const field: React.CSSProperties = { padding: '9px 12px', fontSize: 14, borderRadius: 8, border: 'none', background: '#F2F2F7', fontFamily: FONT, outline: 'none', color: '#1D1D1F' }

  const INCLUDE: { key: keyof Options; label: string; desc: string }[] = [
    { key: 'flags', label: 'Status flags', desc: 'Absent, manager-submitted, reviewed, submit count' },
    { key: 'attachments', label: 'Attachments', desc: 'Photo / file / link URLs' },
    { key: 'comments', label: 'Manager comments', desc: 'Feedback left on entries' },
    { key: 'commitments', label: 'Commitments', desc: 'Promises, due dates & outcomes' },
  ]

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,29,32,0.45)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ ...CARD, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#1D1D1F', fontFamily: FONT, letterSpacing: '-0.02em' }}>Export Report</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, color: '#AEAEB2', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: '#6E6E73', fontFamily: FONT, marginBottom: 20 }}>
          One CSV with a per-employee summary plus full task detail — built for performance reviews and appraisals.
        </div>

        <div style={label}>Date Range</div>
        <div style={{ display: 'flex', gap: 8, margin: '8px 0 6px' }}>
          {[{ v: true, l: 'All time' }, { v: false, l: 'Custom range' }].map(o => (
            <button key={o.l} onClick={() => setAllTime(o.v)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: allTime === o.v ? 600 : 400, background: allTime === o.v ? BRAND.navy : '#F2F2F7', color: allTime === o.v ? 'white' : '#6E6E73' }}>
              {o.l}
            </button>
          ))}
        </div>
        {!allTime && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={{ ...field, flex: 1 }} />
            <span style={{ color: '#AEAEB2', fontSize: 13, fontFamily: FONT }}>to</span>
            <input type="date" value={to} min={from} max={TODAY} onChange={e => setTo(e.target.value)} style={{ ...field, flex: 1 }} />
          </div>
        )}

        <div style={{ ...label, marginTop: 16 }}>Employees</div>
        <select value={empId} onChange={e => setEmpId(e.target.value)} style={{ ...field, width: '100%', marginTop: 8, cursor: 'pointer' }}>
          <option value="">All employees</option>
          {nonMgr.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>

        <div style={{ ...label, marginTop: 16 }}>Include</div>
        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          {INCLUDE.map(item => (
            <label key={item.key}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: '#F7F7FA', cursor: 'pointer', border: '1px solid #eef0f6' }}>
              <input type="checkbox" checked={opts[item.key]} onChange={() => toggle(item.key)} style={{ marginTop: 2, accentColor: BRAND.navy, width: 16, height: 16 }} />
              <span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1D1D1F', fontFamily: FONT }}>{item.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#8E8E93', fontFamily: FONT }}>{item.desc}</span>
              </span>
            </label>
          ))}
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 10, color: '#C62828', fontSize: 13, fontFamily: FONT }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} disabled={busy} style={btn(false)}>Cancel</button>
          <button onClick={run} disabled={busy} style={{ ...btn(true), opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }}>
            {busy ? 'Preparing…' : '↓ Download CSV'}
          </button>
        </div>
      </div>
    </div>
  )
}
