'use client'
import { useState, useEffect, useCallback } from 'react'
import { Entry, Employee, Project, ProjectTask, TaskStatus, Workload } from '@/lib/types'

const TODAY = () => new Date().toISOString().slice(0, 10)
const STATUS_LABELS: Record<TaskStatus, string> = { in_progress: 'In Progress', completed: 'Done', blocked: 'Blocked', carried: 'Carried →' }
const STATUS_ICONS: Record<TaskStatus, string> = { in_progress: '🔵', completed: '✅', blocked: '🚫', carried: '↩️' }

function emptyTask(): ProjectTask { return { project_id: '', task: '', time: '', status: 'in_progress', blockers: '' } }

function TaskDisplay({ tasks, projects }: { tasks: ProjectTask[]; projects: Project[] }) {
  if (!tasks || tasks.length === 0) return <p style={{ fontSize: 13, color: 'var(--text4)' }}>No tasks.</p>
  return (
    <div>
      {tasks.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
          <span className={`status-chip status-${t.status}`}>{STATUS_ICONS[t.status]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{t.task}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {t.project_id && (() => { const p = projects.find(x => x.id === t.project_id); return p ? <span className="project-tag" style={{ background: p.color + '18', borderColor: p.color + '40', color: p.color }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, display: 'inline-block' }} />{p.name}</span> : null })()}
              {t.time && <span style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border)' }}>⏱ {t.time}h</span>}
              <span className={`status-chip status-${t.status}`}>{STATUS_LABELS[t.status]}</span>
            </div>
            {t.blockers && <div style={{ marginTop: 5, fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', padding: '4px 8px', borderRadius: 'var(--r-sm)' }}>🚫 {t.blockers}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

function SubmitOnBehalfModal({ employee, projects, onClose, onDone }: {
  employee: Employee; projects: Project[]; onClose: () => void; onDone: () => void
}) {
  const [tasks, setTasks] = useState<ProjectTask[]>([emptyTask()])
  const [workload, setWorkload] = useState<Workload>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateTask(i: number, field: keyof ProjectTask, value: string) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  async function handleSubmit() {
    const validTasks = tasks.filter(t => t.task.trim())
    if (validTasks.length === 0) { setError('Add at least one task.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employee.id, employee_name: employee.name, date: TODAY(), workload, project_tasks: validTasks, submitted_by_manager: true })
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return }
      onDone()
    } catch { setError('Connection error.') } finally { setSubmitting(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex-between" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>Submit for {employee.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text4)' }}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ marginBottom: 12 }}>
          {tasks.map((t, i) => (
            <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r-sm)', padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 60px', gap: 8, marginBottom: 8 }}>
                <select value={t.project_id} onChange={e => updateTask(i, 'project_id', e.target.value)} style={{ fontSize: 13 }}>
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="text" value={t.task} placeholder="Task description" onChange={e => updateTask(i, 'task', e.target.value)} style={{ fontSize: 14 }} />
                <input type="number" value={t.time} placeholder="hrs" onChange={e => updateTask(i, 'time', e.target.value)} style={{ fontSize: 14 }} />
              </div>
              <div className="status-selector">
                {(['in_progress', 'completed', 'blocked', 'carried'] as TaskStatus[]).map(s => (
                  <button key={s} className={t.status === s ? `active-${s}` : ''} onClick={() => updateTask(i, 'status', s)}>
                    {STATUS_ICONS[s]} {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              {t.status === 'blocked' && (
                <input type="text" value={t.blockers} placeholder="Blocker…" onChange={e => updateTask(i, 'blockers', e.target.value)} style={{ marginTop: 8, fontSize: 13 }} />
              )}
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => setTasks(p => [...p, emptyTask()])}>+ Add Task</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>Workload</label>
          <div className="wl-selector">
            {(['light', 'medium', 'heavy'] as Workload[]).map(w => (
              <button key={w} className={`wl-btn ${workload === w ? `active-${w}` : ''}`} onClick={() => setWorkload(w)}>
                {w === 'light' ? '🟢 Light' : w === 'medium' ? '🟡 Medium' : '🔴 Heavy'}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit on Behalf'}
        </button>
      </div>
    </div>
  )
}

function AddCommentModal({ entryId, onClose, onDone }: { entryId: string; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function handleAdd() {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry_id: entryId, text }) })
      onDone()
    } finally { setSubmitting(false) }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Add Comment</h3>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Enter your note or feedback…" style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAdd} disabled={submitting}>
            {submitting ? 'Adding…' : 'Add Comment'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TodayTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  const [comments, setComments] = useState<Record<string, { id: string; text: string; author: string; timestamp: string }[]>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [submitBehalfEmp, setSubmitBehalfEmp] = useState<Employee | null>(null)
  const [commentEntryId, setCommentEntryId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [emps, ents, projs, rev] = await Promise.all([
        fetch('/api/employees').then(r => r.json()),
        fetch(`/api/entries?today=${TODAY()}`).then(r => r.json()),
        fetch('/api/projects').then(r => r.json()),
        fetch('/api/reviewed').then(r => r.json()),
      ])
      setEmployees(emps.employees || [])
      setEntries(ents.entries || [])
      setProjects(projs.projects || [])
      setReviewedIds(new Set(rev.reviewed_ids || []))
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function fetchComments(entryId: string) {
    const res = await fetch(`/api/comments?entry_id=${entryId}`)
    const d = await res.json()
    setComments(prev => ({ ...prev, [entryId]: d.comments || [] }))
  }

  async function toggleReviewed(entryId: string) {
    if (reviewedIds.has(entryId)) {
      await fetch(`/api/reviewed?entry_id=${entryId}`, { method: 'DELETE' })
      setReviewedIds(prev => { const s = new Set(prev); s.delete(entryId); return s })
    } else {
      await fetch('/api/reviewed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry_id: entryId }) })
      setReviewedIds(prev => new Set([...prev, entryId]))
    }
  }

  async function markAbsent(emp: Employee) {
    if (!confirm(`Mark ${emp.name} as absent for today?`)) return
    await fetch('/api/entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: emp.id, employee_name: emp.name, date: TODAY(), workload: 'light', is_absent: true, project_tasks: [], submitted_by_manager: true })
    })
    load()
  }

  const nonManagerEmps = employees.filter(e => e.role === 'employee')
  const filtered = nonManagerEmps.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
  const entryMap = Object.fromEntries(entries.map(e => [e.employee_id, e]))

  const submitted = filtered.filter(e => entryMap[e.id] && !entryMap[e.id].is_absent)
  const absent = filtered.filter(e => entryMap[e.id]?.is_absent)
  const missing = filtered.filter(e => !entryMap[e.id])
  const withBlockers = submitted.filter(e => entryMap[e.id]?.project_tasks?.some(t => t.status === 'blocked'))
  const heavyLoad = submitted.filter(e => entryMap[e.id]?.workload === 'heavy')

  if (loading) return <div className="empty-state"><div className="spinner" style={{ width: 28, height: 28, margin: '0 auto' }} /></div>

  return (
    <div>
      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--green)' }}>{submitted.length}</div>
          <div className="stat-label">Submitted</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--text4)' }}>{missing.length}</div>
          <div className="stat-label">Missing</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--red)' }}>{absent.length}</div>
          <div className="stat-label">Absent</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--orange)' }}>{withBlockers.length}</div>
          <div className="stat-label">Blockers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--red)' }}>{heavyLoad.length}</div>
          <div className="stat-label">Heavy Load</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 16 }}>
        <input type="text" placeholder="🔍 Filter by name…" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      {/* Submitted entries */}
      {submitted.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-header">
            <span className="section-title">✅ Submitted ({submitted.length})</span>
          </div>
          {submitted.map(emp => {
            const entry = entryMap[emp.id]
            const isExpanded = expandedId === entry.id
            const isReviewed = reviewedIds.has(entry.id)
            return (
              <div key={emp.id} className={`entry-card ${entry.workload}`} style={{ borderLeftColor: isReviewed ? 'var(--text4)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => {
                  if (!isExpanded) fetchComments(entry.id)
                  setExpandedId(isExpanded ? null : entry.id)
                }}>
                  <div className="avatar" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', fontSize: 13 }}>
                    {emp.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{emp.name}
                      {entry.submitted_by_manager && <span style={{ fontSize: 11, color: 'var(--text4)', marginLeft: 6 }}>via manager</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                      <span className={`badge badge-${entry.workload}`}>{entry.workload}</span>
                      <span>{entry.project_tasks?.length || 0} tasks</span>
                      {entry.project_tasks?.some(t => t.status === 'blocked') && <span style={{ color: 'var(--red)' }}>🚫 blocker</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {isReviewed && <span style={{ fontSize: 12, color: 'var(--text4)', fontWeight: 600 }}>✓ Reviewed</span>}
                    <span style={{ color: 'var(--text4)', fontSize: 18 }}>{isExpanded ? '▾' : '▸'}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 14 }}>
                    <div className="divider" />
                    <TaskDisplay tasks={entry.project_tasks} projects={projects} />
                    {/* Comments */}
                    {comments[entry.id]?.length > 0 && (
                      <div style={{ marginTop: 12, padding: 10, background: 'var(--bg)', borderRadius: 'var(--r-sm)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>MANAGER NOTES</div>
                        {comments[entry.id].map(c => (
                          <div key={c.id} style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>💬 {c.text}</div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button className={`btn btn-sm ${isReviewed ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleReviewed(entry.id)}>
                        {isReviewed ? '↩ Unmark Reviewed' : '✓ Mark Reviewed'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setCommentEntryId(entry.id)}>💬 Add Note</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Missing employees */}
      {missing.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-header">
            <span className="section-title">⏳ Pending ({missing.length})</span>
          </div>
          {missing.map(emp => (
            <div key={emp.id} style={{ background: 'var(--card)', borderRadius: 'var(--r-md)', padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow)' }}>
              <div className="avatar" style={{ background: 'var(--bg)', color: 'var(--text4)', fontSize: 13 }}>{emp.name.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{emp.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text4)' }}>Not submitted yet</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setSubmitBehalfEmp(emp)}>Submit for them</button>
                <button className="btn btn-danger btn-sm" onClick={() => markAbsent(emp)}>Mark Absent</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Absent */}
      {absent.length > 0 && (
        <div>
          <div className="section-header">
            <span className="section-title">🏖 Absent ({absent.length})</span>
          </div>
          {absent.map(emp => (
            <div key={emp.id} className="entry-card absent" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="avatar" style={{ background: 'var(--bg)', color: 'var(--text4)', fontSize: 13 }}>{emp.name.charAt(0)}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text3)' }}>{emp.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text4)' }}>Marked absent</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {submitBehalfEmp && (
        <SubmitOnBehalfModal
          employee={submitBehalfEmp}
          projects={projects}
          onClose={() => setSubmitBehalfEmp(null)}
          onDone={() => { setSubmitBehalfEmp(null); load() }}
        />
      )}
      {commentEntryId && (
        <AddCommentModal
          entryId={commentEntryId}
          onClose={() => setCommentEntryId(null)}
          onDone={() => { fetchComments(commentEntryId); setCommentEntryId(null) }}
        />
      )}
    </div>
  )
}
