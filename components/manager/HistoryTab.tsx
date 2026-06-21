'use client'
import { useState, useEffect, useCallback } from 'react'
import { Entry, Employee, Project, ProjectTask, TaskStatus } from '@/lib/types'

const STATUS_LABELS: Record<TaskStatus, string> = { in_progress: 'In Progress', completed: 'Done', blocked: 'Blocked', carried: 'Carried →' }
const STATUS_ICONS: Record<TaskStatus, string> = { in_progress: '🔵', completed: '✅', blocked: '🚫', carried: '↩️' }

function dateRange(days: number) {
  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  return { from, to }
}

function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtShort(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function getWeekDates(offset = 0) {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function TaskDisplay({ tasks, projects }: { tasks: ProjectTask[]; projects: Project[] }) {
  if (!tasks || tasks.length === 0) return null
  return (
    <div style={{ marginTop: 8 }}>
      {tasks.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
          <span className={`status-chip status-${t.status}`} style={{ fontSize: 11 }}>{STATUS_ICONS[t.status]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{t.task}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
              {t.project_id && (() => { const p = projects.find(x => x.id === t.project_id); return p ? <span className="project-tag" style={{ fontSize: 11, background: p.color + '18', borderColor: p.color + '40', color: p.color }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: p.color, display: 'inline-block' }} />{p.name}</span> : null })()}
              {t.time && <span style={{ fontSize: 11, color: 'var(--text3)' }}>⏱ {t.time}h</span>}
              <span className={`status-chip status-${t.status}`} style={{ fontSize: 11 }}>{STATUS_LABELS[t.status]}</span>
            </div>
            {t.blockers && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>🚫 {t.blockers}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── List View ──────────────────────────────────────────────────────────────
function ListView({ entries, projects }: { entries: Entry[]; projects: Project[] }) {
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = entries.filter(e => !filter || e.employee_name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <input type="text" placeholder="🔍 Filter by name…" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">No entries found</div>
        </div>
      )}
      {filtered.map(entry => {
        const isExpanded = expanded === entry.id
        return (
          <div key={entry.id} className={`entry-card ${entry.workload}`}>
            <div style={{ display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'center' }} onClick={() => setExpanded(isExpanded ? null : entry.id)}>
              <div className="avatar" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', fontSize: 12 }}>{entry.employee_name.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.employee_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                  <span>{fmtDate(entry.date)}</span>
                  <span className={`badge badge-${entry.workload}`}>{entry.workload}</span>
                  {entry.is_absent ? <span style={{ color: 'var(--text4)' }}>Absent</span> : <span>{entry.project_tasks?.length || 0} tasks</span>}
                  {entry.submitted_by_manager && <span style={{ color: 'var(--text4)' }}>via manager</span>}
                </div>
              </div>
              <span style={{ color: 'var(--text4)', fontSize: 16 }}>{isExpanded ? '▾' : '▸'}</span>
            </div>
            {isExpanded && !entry.is_absent && (
              <div style={{ marginTop: 10 }}>
                <div className="divider" />
                <TaskDisplay tasks={entry.project_tasks} projects={projects} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Weekly View ────────────────────────────────────────────────────────────
function WeeklyView({ entries, employees }: { entries: Entry[]; employees: Employee[] }) {
  const [offset, setOffset] = useState(0)
  const days = getWeekDates(offset)
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const nonManagerEmps = employees.filter(e => e.role === 'employee')

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setOffset(o => o - 1)}>← Prev</button>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {fmtShort(days[0])} — {fmtShort(days[6])}
          {offset === 0 && <span style={{ fontSize: 12, color: 'var(--blue)', marginLeft: 8 }}>This week</span>}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset >= 0}>Next →</button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Employee</th>
              {days.map((d, i) => (
                <th key={d} style={{ padding: '10px 8px', textAlign: 'center', color: d === new Date().toISOString().slice(0, 10) ? 'var(--blue)' : 'var(--text3)', fontWeight: 600 }}>
                  {dayLabels[i]}<br /><span style={{ fontSize: 11, fontWeight: 400 }}>{fmtShort(d)}</span>
                </th>
              ))}
              <th style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text3)', fontWeight: 600 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {nonManagerEmps.map(emp => {
              const empEntries = Object.fromEntries(entries.filter(e => e.employee_id === emp.id).map(e => [e.date, e]))
              const weekTotal = days.reduce((sum, d) => {
                const e = empEntries[d]
                return sum + (e && !e.is_absent ? (e.project_tasks?.reduce((s, t) => s + (parseFloat(t.time) || 0), 0) || 0) : 0)
              }, 0)
              return (
                <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>{emp.name}</td>
                  {days.map(d => {
                    const e = empEntries[d]
                    const isWeekend = [0, 6].includes(new Date(d + 'T12:00:00').getDay())
                    return (
                      <td key={d} style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {e?.is_absent ? (
                          <span title="Absent" style={{ display: 'inline-flex', width: 24, height: 24, borderRadius: '50%', background: 'var(--border)', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>A</span>
                        ) : e ? (
                          <span title={`${e.workload} · ${e.project_tasks?.length || 0} tasks`}
                            style={{ display: 'inline-flex', width: 24, height: 24, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                              background: e.workload === 'heavy' ? 'var(--red)' : e.workload === 'medium' ? 'var(--orange)' : 'var(--green)', color: 'white' }}>
                            {e.project_tasks?.length || '✓'}
                          </span>
                        ) : isWeekend ? (
                          <span style={{ fontSize: 11, color: 'var(--border)' }}>—</span>
                        ) : (
                          <span style={{ display: 'inline-flex', width: 24, height: 24, borderRadius: '50%', background: 'var(--border)' }} />
                        )}
                      </td>
                    )
                  })}
                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: weekTotal > 0 ? 'var(--blue)' : 'var(--text4)', fontSize: 12 }}>
                    {weekTotal > 0 ? `${weekTotal.toFixed(1)}h` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, color: 'var(--text3)', flexWrap: 'wrap' }}>
        {[['var(--green)', 'Light'], ['var(--orange)', 'Medium'], ['var(--red)', 'Heavy']].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: c, display: 'inline-block' }} /> {l}</span>
        ))}
        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--border)', display: 'inline-block' }} /> A = Absent</span>
      </div>
    </div>
  )
}

// ── People View ────────────────────────────────────────────────────────────
function PeopleView({ entries, employees, projects }: { entries: Entry[]; employees: Employee[]; projects: Project[] }) {
  const [selectedEmp, setSelectedEmp] = useState<string>('')
  const nonManagerEmps = employees.filter(e => e.role === 'employee')
  const empId = selectedEmp || nonManagerEmps[0]?.id || ''
  const empEntries = entries.filter(e => e.employee_id === empId)
  const today = new Date().toISOString().slice(0, 10)

  const submitted = empEntries.filter(e => !e.is_absent)
  const allTasks = submitted.flatMap(e => e.project_tasks || [])
  const totalHours = allTasks.reduce((s, t) => s + (parseFloat(t.time) || 0), 0)
  const completedTasks = allTasks.filter(t => t.status === 'completed').length
  const completionRate = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0

  const projectHours: Record<string, number> = {}
  allTasks.forEach(t => { if (t.project_id) projectHours[t.project_id] = (projectHours[t.project_id] || 0) + (parseFloat(t.time) || 0) })
  const topProjects = Object.entries(projectHours).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxHrs = topProjects[0]?.[1] || 1

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <select value={empId} onChange={e => setSelectedEmp(e.target.value)}>
          {nonManagerEmps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--blue)' }}>{submitted.length}</div><div className="stat-label">Days Submitted</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--green)' }}>{totalHours.toFixed(1)}h</div><div className="stat-label">Total Hours</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--orange)' }}>{completionRate}%</div><div className="stat-label">Completion Rate</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--red)' }}>{empEntries.filter(e => e.is_absent).length}</div><div className="stat-label">Days Absent</div></div>
      </div>

      {/* 30-day heatmap */}
      <div className="card card-p" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Last 30 Days</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Array.from({ length: 30 }).map((_, i) => {
            const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10)
            const e = empEntries.find(x => x.date === d)
            const isWeekend = [0, 6].includes(new Date(d + 'T12:00:00').getDay())
            return (
              <div key={d} title={d} style={{ width: 20, height: 20, borderRadius: 4, background: e?.is_absent ? 'var(--red-bg)' : e ? (e.workload === 'heavy' ? 'var(--red)' : e.workload === 'medium' ? 'var(--orange)' : 'var(--green)') : isWeekend ? 'var(--bg)' : 'var(--border)', border: d === today ? '2px solid var(--blue)' : 'none' }} />
            )
          })}
        </div>
      </div>

      {topProjects.length > 0 && (
        <div className="card card-p" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Project Breakdown</div>
          {topProjects.map(([pid, hrs]) => {
            const p = projects.find(x => x.id === pid)
            return (
              <div key={pid} style={{ marginBottom: 10 }}>
                <div className="flex-between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p?.name || pid}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{hrs.toFixed(1)}h</span>
                </div>
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${(hrs / maxHrs) * 100}%`, background: p?.color || 'var(--blue)', borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Recent Entries</div>
        {empEntries.slice(0, 7).map(entry => (
          <div key={entry.id} className={`entry-card ${entry.workload}`} style={{ marginBottom: 8 }}>
            <div className="flex-between" style={{ marginBottom: entry.is_absent ? 0 : 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtDate(entry.date)}</span>
              {entry.is_absent ? <span style={{ fontSize: 12, color: 'var(--text4)' }}>Absent</span> : <span className={`badge badge-${entry.workload}`}>{entry.workload}</span>}
            </div>
            {!entry.is_absent && <TaskDisplay tasks={entry.project_tasks} projects={projects} />}
          </div>
        ))}
        {empEntries.length === 0 && <div className="empty-state"><div className="empty-state-text">No entries in this date range</div></div>}
      </div>
    </div>
  )
}

// ── Calendar View ──────────────────────────────────────────────────────────
function CalendarView({ entries }: { entries: Entry[] }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const now = new Date()
  const month = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const monthYear = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const firstDayOfWeek = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date().toISOString().slice(0, 10)

  const entryByDate: Record<string, Entry[]> = {}
  entries.forEach(e => { if (!entryByDate[e.date]) entryByDate[e.date] = []; entryByDate[e.date].push(e) })

  const selectedEntries = selectedDay ? entryByDate[selectedDay] || [] : []

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => { setMonthOffset(o => o - 1); setSelectedDay(null) }}>← Prev</button>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{monthYear}</span>
        <button className="btn btn-secondary btn-sm" onClick={() => { setMonthOffset(o => Math.min(0, o + 1)); setSelectedDay(null) }} disabled={monthOffset >= 0}>Next →</button>
      </div>

      <div className="card card-p">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
          {dayLabels.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text3)', padding: '4px 0' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayEntries = entryByDate[dateStr] || []
            const isSelected = dateStr === selectedDay
            const isToday = dateStr === today
            const workloads = dayEntries.filter(e => !e.is_absent).map(e => e.workload)
            return (
              <div key={dateStr} onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                style={{ aspectRatio: '1', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: dayEntries.length > 0 ? 'pointer' : 'default', padding: 2,
                  border: isSelected ? '2px solid var(--blue)' : isToday ? '2px solid rgba(0,122,255,0.4)' : '2px solid transparent',
                  background: isSelected ? 'var(--blue-bg)' : dayEntries.length > 0 ? 'var(--bg)' : 'transparent' }}>
                <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--blue)' : 'var(--text)' }}>{day}</span>
                {dayEntries.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                    {workloads.includes('heavy') && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--red)' }} />}
                    {workloads.includes('medium') && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--orange)' }} />}
                    {workloads.includes('light') && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)' }} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {selectedDay && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{fmtDate(selectedDay)} — {selectedEntries.length} submission{selectedEntries.length !== 1 ? 's' : ''}</div>
          {selectedEntries.length === 0
            ? <div className="card card-p" style={{ color: 'var(--text4)', fontSize: 14 }}>No submissions on this day.</div>
            : selectedEntries.map(e => (
              <div key={e.id} className={`entry-card ${e.workload}`} style={{ marginBottom: 8 }}>
                <div className="flex-between">
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{e.employee_name}</span>
                  {e.is_absent ? <span style={{ fontSize: 12, color: 'var(--text4)' }}>Absent</span> : <span className={`badge badge-${e.workload}`}>{e.workload}</span>}
                </div>
                {!e.is_absent && e.project_tasks?.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text3)' }}>{e.project_tasks.length} task{e.project_tasks.length !== 1 ? 's' : ''} logged</div>
                )}
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
type View = 'list' | 'weekly' | 'people' | 'calendar'

export default function HistoryTab() {
  const [view, setView] = useState<View>('list')
  const [from, setFrom] = useState(dateRange(30).from)
  const [to, setTo] = useState(dateRange(30).to)
  const [entries, setEntries] = useState<Entry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ents, emps, projs] = await Promise.all([
        fetch(`/api/entries?from=${from}&to=${to}`).then(r => r.json()),
        fetch('/api/employees').then(r => r.json()),
        fetch('/api/projects').then(r => r.json()),
      ])
      setEntries(ents.entries || [])
      setEmployees(emps.employees || [])
      setProjects(projs.projects || [])
    } finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  return (
    <div>
      {/* Date range */}
      <div style={{ background: 'var(--card)', borderRadius: 'var(--r-md)', padding: 14, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 220 }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ flex: 1 }} />
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }].map(p => (
            <button key={p.label} className="btn btn-secondary btn-sm" onClick={() => { setFrom(dateRange(p.days).from); setTo(dateRange(p.days).to) }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Sub-view tabs */}
      <div className="sub-tab-bar">
        {[{ id: 'list', label: '📋 List' }, { id: 'weekly', label: '📅 Weekly' }, { id: 'people', label: '👤 People' }, { id: 'calendar', label: '🗓 Calendar' }].map(v => (
          <button key={v.id} className={`sub-tab-btn ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id as View)}>{v.label}</button>
        ))}
      </div>

      {loading
        ? <div className="empty-state"><div className="spinner" style={{ width: 28, height: 28, margin: '0 auto' }} /></div>
        : <>
          {view === 'list' && <ListView entries={entries} projects={projects} />}
          {view === 'weekly' && <WeeklyView entries={entries} employees={employees} />}
          {view === 'people' && <PeopleView entries={entries} employees={employees} projects={projects} />}
          {view === 'calendar' && <CalendarView entries={entries} />}
        </>
      }
    </div>
  )
}
