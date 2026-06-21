'use client'
import { useState, useEffect, useCallback } from 'react'
import { Session, Entry, Project, ProjectTask, TaskStatus, Workload } from '@/lib/types'

const TODAY = () => new Date().toISOString().slice(0, 10)
const FMT_DATE = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const STATUS_LABELS: Record<TaskStatus, string> = { in_progress: 'In Progress', completed: 'Done', blocked: 'Blocked', carried: 'Carried →' }
const STATUS_ICONS: Record<TaskStatus, string> = { in_progress: '🔵', completed: '✅', blocked: '🚫', carried: '↩️' }

function emptyTask(): ProjectTask { return { project_id: '', task: '', time: '', status: 'in_progress', blockers: '' } }

function ProjectTag({ project_id, projects }: { project_id: string; projects: Project[] }) {
  const p = projects.find(x => x.id === project_id)
  if (!p) return null
  return (
    <span className="project-tag" style={{ background: p.color + '18', borderColor: p.color + '40', color: p.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
      {p.name}
    </span>
  )
}

function TaskDisplay({ tasks, projects }: { tasks: ProjectTask[]; projects: Project[] }) {
  if (!tasks || tasks.length === 0) return <p style={{ color: 'var(--text4)', fontSize: 14 }}>No tasks logged.</p>
  return (
    <div>
      {tasks.map((t, i) => (
        <div key={i} className="task-item" style={{ gap: 10, alignItems: 'flex-start', paddingTop: 10 }}>
          <span className={`status-chip status-${t.status}`}>{STATUS_ICONS[t.status]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{t.task || '(no task text)'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {t.project_id && <ProjectTag project_id={t.project_id} projects={projects} />}
              {t.time && <span style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border)' }}>⏱ {t.time}h</span>}
              <span className={`status-chip status-${t.status}`}>{STATUS_LABELS[t.status]}</span>
            </div>
            {t.blockers && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--red)', background: 'var(--red-bg)', padding: '6px 10px', borderRadius: 'var(--r-sm)' }}>🚫 {t.blockers}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function EmployeePage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<'update' | 'stats'>('update')
  const [todayEntry, setTodayEntry] = useState<Entry | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [tasks, setTasks] = useState<ProjectTask[]>([emptyTask()])
  const [workload, setWorkload] = useState<Workload>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [broadcast, setBroadcast] = useState<{ message: string; active: boolean } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [eRes, pRes, bRes, hRes] = await Promise.all([
        fetch(`/api/entries?today=${TODAY()}&employee_id=${session.id}`),
        fetch('/api/projects'),
        fetch('/api/broadcast'),
        fetch(`/api/entries?employee_id=${session.id}&from=${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}&to=${TODAY()}`),
      ])
      const [eData, pData, bData, hData] = await Promise.all([eRes.json(), pRes.json(), bRes.json(), hRes.json()])
      setTodayEntry(eData.entries?.[0] || null)
      setProjects(pData.projects || [])
      if (bData.active) setBroadcast(bData)
      setEntries(hData.entries || [])
    } catch {
      setError('Failed to load data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [session.id])

  useEffect(() => { fetchData() }, [fetchData])

  function addTask() { setTasks(prev => [...prev, emptyTask()]) }
  function removeTask(i: number) { setTasks(prev => prev.filter((_, idx) => idx !== i)) }
  function updateTask(i: number, field: keyof ProjectTask, value: string) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  async function handleSubmit() {
    const validTasks = tasks.filter(t => t.task.trim())
    if (validTasks.length === 0) { setError('Add at least one task.'); return }
    setSubmitting(true); setError('')
    try {
      if (editMode && todayEntry) {
        const res = await fetch('/api/entries', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: todayEntry.id, project_tasks: validTasks, workload, submit_count: (todayEntry.submit_count || 1) + 1 })
        })
        if (!res.ok) { const d = await res.json(); setError(d.error || 'Update failed.'); return }
      } else {
        const res = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: session.id, employee_name: session.name, date: TODAY(), workload, project_tasks: validTasks })
        })
        if (!res.ok) { const d = await res.json(); setError(d.error || 'Submission failed.'); return }
      }
      setEditMode(false)
      await fetchData()
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit() {
    if (!todayEntry) return
    setTasks(todayEntry.project_tasks?.length ? todayEntry.project_tasks : [emptyTask()])
    setWorkload(todayEntry.workload)
    setEditMode(true)
  }

  const today = TODAY()
  const hasSubmitted = !!todayEntry && !editMode

  // Stats calc
  const workDays = entries.filter(e => !e.is_absent).length
  const absentDays = entries.filter(e => e.is_absent).length
  const allTasks = entries.flatMap(e => e.project_tasks || [])
  const totalHours = allTasks.reduce((s, t) => s + (parseFloat(t.time) || 0), 0)
  const completedTasks = allTasks.filter(t => t.status === 'completed').length
  const completionRate = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0
  const projectHours: Record<string, number> = {}
  allTasks.forEach(t => { if (t.project_id) projectHours[t.project_id] = (projectHours[t.project_id] || 0) + (parseFloat(t.time) || 0) })
  const topProjects = Object.entries(projectHours).sort((a, b) => b[1] - a[1]).slice(0, 4)

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* NavBar */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="navbar-logo">📋</div>
          <span className="navbar-title">Daily Tracker</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', fontSize: 13 }}>
            {session.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{session.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={onLogout}>Logout</button>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
        {/* Broadcast */}
        {broadcast?.active && broadcast.message && (
          <div className="broadcast-banner">📢 <span>{broadcast.message}</span></div>
        )}

        {/* Tab bar */}
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${tab === 'update' ? 'active' : ''}`} onClick={() => setTab('update')}>My Update</button>
          <button className={`tab-btn ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>My Stats</button>
        </div>

        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ width: 28, height: 28, margin: '0 auto' }} /></div>
        ) : tab === 'update' ? (
          /* ── MY UPDATE TAB ── */
          <div>
            {/* Submitted state */}
            {hasSubmitted && !editMode && (
              <>
                <div className="card card-p" style={{ padding: '20px 20px 16px', marginBottom: 12, borderLeft: `4px solid var(--green)` }}>
                  <div className="flex-between" style={{ marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                        ✅ Submitted — {FMT_DATE(today)}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                        {todayEntry!.submit_count > 1 ? `Resubmitted ${todayEntry!.submit_count}x · ` : ''}
                        <span className={`badge badge-${todayEntry!.workload}`}>{todayEntry!.workload}</span>
                      </div>
                    </div>
                    {(todayEntry!.submit_count || 1) < 2 && (
                      <button className="btn btn-secondary btn-sm" onClick={startEdit}>Edit</button>
                    )}
                  </div>
                  <TaskDisplay tasks={todayEntry!.project_tasks} projects={projects} />
                </div>
              </>
            )}

            {/* Form (new or edit) */}
            {(!hasSubmitted || editMode) && (
              <div className="card" style={{ padding: 20 }}>
                <div className="flex-between" style={{ marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>
                      {editMode ? '✏️ Edit Today\'s Update' : `📝 Today's Update`}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text3)' }}>{FMT_DATE(today)}</div>
                  </div>
                  {editMode && <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(false)}>Cancel</button>}
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                {/* Task rows */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ marginBottom: 8 }}>Tasks</label>
                  {tasks.map((t, i) => (
                    <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: 12, marginBottom: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 70px', gap: 8, marginBottom: 8 }}>
                        <select value={t.project_id} onChange={e => updateTask(i, 'project_id', e.target.value)} style={{ fontSize: 13 }}>
                          <option value="">No project</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input type="text" value={t.task} placeholder="What did you work on?"
                          onChange={e => updateTask(i, 'task', e.target.value)} style={{ fontSize: 14 }} />
                        <input type="number" value={t.time} placeholder="hrs" min="0" step="0.5"
                          onChange={e => updateTask(i, 'time', e.target.value)} style={{ fontSize: 14, textAlign: 'center' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div className="status-selector">
                          {(['in_progress', 'completed', 'blocked', 'carried'] as TaskStatus[]).map(s => (
                            <button key={s} className={t.status === s ? `active-${s}` : ''} onClick={() => updateTask(i, 'status', s)}>
                              {STATUS_ICONS[s]} {STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                        {tasks.length > 1 && (
                          <button onClick={() => removeTask(i)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4)', fontSize: 16, padding: '0 4px' }}>✕</button>
                        )}
                      </div>
                      {t.status === 'blocked' && (
                        <input type="text" value={t.blockers} placeholder="Describe the blocker…"
                          onChange={e => updateTask(i, 'blockers', e.target.value)}
                          style={{ marginTop: 8, fontSize: 13, background: 'var(--red-bg)', borderColor: 'rgba(255,59,48,0.3)' }} />
                      )}
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={addTask} style={{ marginTop: 4 }}>+ Add Task</button>
                </div>

                {/* Workload */}
                <div style={{ marginBottom: 20 }}>
                  <label>Overall Workload</label>
                  <div className="wl-selector">
                    {(['light', 'medium', 'heavy'] as Workload[]).map(w => (
                      <button key={w} className={`wl-btn ${workload === w ? `active-${w}` : ''}`} onClick={() => setWorkload(w)}>
                        {w === 'light' ? '🟢 Light' : w === 'medium' ? '🟡 Medium' : '🔴 Heavy'}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting…' : editMode ? 'Update Submission' : 'Submit Update ✓'}
                </button>
              </div>
            )}

            {/* Recent history */}
            {entries.filter(e => e.date !== today).slice(0, 5).map(entry => (
              <div key={entry.id} className={`entry-card ${entry.workload}`} style={{ marginTop: 10 }}>
                <div className="flex-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{FMT_DATE(entry.date)}</span>
                  <span className={`badge badge-${entry.workload}`}>{entry.workload}</span>
                </div>
                {entry.is_absent ? (
                  <span style={{ fontSize: 14, color: 'var(--text4)' }}>Marked absent</span>
                ) : (
                  <TaskDisplay tasks={entry.project_tasks} projects={projects} />
                )}
              </div>
            ))}
          </div>
        ) : (
          /* ── MY STATS TAB ── */
          <div>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--blue)' }}>{workDays}</div>
                <div className="stat-label">Days Submitted</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--green)' }}>{totalHours.toFixed(1)}h</div>
                <div className="stat-label">Total Hours</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--orange)' }}>{completionRate}%</div>
                <div className="stat-label">Completion Rate</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--red)' }}>{absentDays}</div>
                <div className="stat-label">Days Absent</div>
              </div>
            </div>

            {topProjects.length > 0 && (
              <div className="card card-p" style={{ marginBottom: 12 }}>
                <div className="section-title" style={{ marginBottom: 14 }}>Project Breakdown</div>
                {topProjects.map(([pid, hrs]) => {
                  const p = projects.find(x => x.id === pid)
                  const max = topProjects[0][1]
                  return (
                    <div key={pid} style={{ marginBottom: 10 }}>
                      <div className="flex-between" style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{p?.name || pid}</span>
                        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{hrs.toFixed(1)}h</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(hrs / max) * 100}%`, background: p?.color || 'var(--blue)', borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="card card-p">
              <div className="section-title" style={{ marginBottom: 14 }}>Last 30 Days</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {Array.from({ length: 30 }).map((_, i) => {
                  const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10)
                  const entry = entries.find(e => e.date === d)
                  const isWeekend = [0, 6].includes(new Date(d + 'T12:00:00').getDay())
                  return (
                    <div key={d} title={d}
                      style={{ width: 20, height: 20, borderRadius: 4, background: entry?.is_absent ? 'var(--red-bg)' : entry ? (entry.workload === 'heavy' ? 'var(--red)' : entry.workload === 'medium' ? 'var(--orange)' : 'var(--green)') : isWeekend ? 'var(--bg)' : 'var(--border)', border: d === today ? '2px solid var(--blue)' : 'none' }}
                    />
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--green)', display: 'inline-block' }} /> Light</span>
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--orange)', display: 'inline-block' }} /> Medium</span>
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--red)', display: 'inline-block' }} /> Heavy</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
