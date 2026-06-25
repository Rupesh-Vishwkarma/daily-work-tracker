'use client'
import { useState, useEffect, useCallback } from 'react'
import { Session, Entry, Project, ProjectTask, TaskStatus, Workload, Comment } from '@/lib/types'
import { FONT, CARD, fmtDate as FMT_DATE } from '@/lib/ui'

const TODAY = () => new Date().toISOString().slice(0, 10)

const TASK_STATUS: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  completed:   { label: 'Done',        color: '#34C759', bg: 'rgba(52,199,89,0.1)' },
  in_progress: { label: 'In Progress', color: '#0071E3', bg: 'rgba(0,113,227,0.1)' },
  blocked:     { label: 'Blocked',     color: '#FF3B30', bg: 'rgba(255,59,48,0.1)' },
  carried:     { label: 'Carries →',   color: '#FF9500', bg: 'rgba(255,149,0,0.1)' },
}
const WL: Record<Workload, { label: string; color: string; bg: string }> = {
  light:  { label: 'Light',  color: '#34C759', bg: 'rgba(52,199,89,0.1)' },
  medium: { label: 'Medium', color: '#FF9500', bg: 'rgba(255,149,0,0.1)' },
  heavy:  { label: 'Heavy',  color: '#FF3B30', bg: 'rgba(255,59,48,0.1)' },
}

interface LocalTask extends ProjectTask {
  uid: number
  showBlockers: boolean
}

function mkTask(): LocalTask {
  return { uid: Date.now() + Math.random(), project_id: '', task: '', time: '', status: 'in_progress', blockers: '', showBlockers: false }
}

function toLocalTask(t: ProjectTask): LocalTask {
  return { ...t, uid: Date.now() + Math.random(), showBlockers: !!t.blockers }
}

function toProjectTask({ uid: _u, showBlockers: _s, ...rest }: LocalTask): ProjectTask {
  return rest
}

// ── Task display (submitted view) ─────────────────────────────────────────────
function TaskDisplay({ tasks, projects }: { tasks: ProjectTask[]; projects: Project[] }) {
  if (!tasks || tasks.length === 0) return <p style={{ color: '#AEAEB2', fontSize: 13, fontStyle: 'italic' }}>No tasks logged.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.map((t, i) => {
        const proj = projects.find(p => p.id === t.project_id)
        const si = TASK_STATUS[t.status] || TASK_STATUS.in_progress
        return (
          <div key={i} style={{ background: '#F5F5F7', borderRadius: 12, padding: '12px 14px', borderLeft: `3px solid ${proj?.color || 'rgba(0,0,0,0.12)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              {proj && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 600, background: proj.color + '18', color: proj.color }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: proj.color, flexShrink: 0 }} />{proj.name}
                </span>
              )}
              {t.project_id === '__other__' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,0.06)', color: '#6E6E73' }}>Other Work</span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 700, background: si.bg, color: si.color }}>{si.label}</span>
              {t.time && <span style={{ fontSize: 11, color: '#AEAEB2', marginLeft: 'auto' }}>{t.time}h</span>}
            </div>
            <div style={{ color: '#1D1D1F', fontSize: 14, lineHeight: 1.55 }}>{t.task}</div>
            {t.blockers && (
              <div style={{ fontSize: 13, color: '#B25900', background: 'rgba(255,149,0,0.08)', padding: '8px 12px', borderRadius: 8, borderLeft: '3px solid #FF9500', marginTop: 10, lineHeight: 1.5 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Blocker</div>
                {t.blockers}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Manager notes (visible to employee) ──────────────────────────────────────
function ManagerNotes({ comments }: { comments: Comment[] }) {
  if (!comments.length) return null
  return (
    <div style={{ marginTop: 12 }}>
      {comments.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(0,113,227,0.06)', borderRadius: 10, borderLeft: '3px solid #0071E3', marginTop: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0071E3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'white', fontFamily: FONT }}>M</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0071E3', fontFamily: FONT, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manager note</div>
            <div style={{ fontSize: 13, color: '#1D1D1F', fontFamily: FONT, lineHeight: 1.5 }}>{c.text}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── My Stats tab ─────────────────────────────────────────────────────────────
function MyStats({ entries, projects }: { entries: Entry[]; projects: Project[] }) {
  const myE = entries.filter(e => !e.is_absent).sort((a, b) => b.date.localeCompare(a.date))
  if (!myE.length) return (
    <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 0 rgba(0,0,0,0.04),0 2px 16px rgba(0,0,0,0.05)', padding: '56px 20px', textAlign: 'center' }}>
      <div style={{ fontWeight: 600, fontSize: 16, color: '#AEAEB2', marginBottom: 4 }}>No data yet</div>
      <div style={{ fontSize: 13, color: '#AEAEB2' }}>Submit your first update to see stats.</div>
    </div>
  )
  const allTasks = myE.flatMap(e => e.project_tasks || [])
  const totalHours = allTasks.reduce((s, t) => s + (parseFloat(t.time) || 0), 0)
  const completionRate = allTasks.length ? Math.round(allTasks.filter(t => t.status === 'completed').length / allTasks.length * 100) : null
  const wlC = { heavy: myE.filter(e => e.workload === 'heavy').length, medium: myE.filter(e => e.workload === 'medium').length, light: myE.filter(e => e.workload === 'light').length }
  const projH: Record<string, number> = {}
  allTasks.forEach(t => { if (t.project_id) projH[t.project_id] = (projH[t.project_id] || 0) + (parseFloat(t.time) || 0) })
  const projBreak = Object.entries(projH).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxH = Math.max(...projBreak.map(([, h]) => h), 1)

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: '#1D1D1F', marginBottom: 20 }}>My Performance</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { v: myE.length, l: 'Total Updates', c: '#0071E3' },
          { v: totalHours > 0 ? totalHours.toFixed(1) + 'h' : '—', l: 'Hours Logged', c: '#6366F1' },
          { v: completionRate !== null ? completionRate + '%' : '—', l: 'Completion Rate', c: '#34C759' },
        ].map(s => (
          <div key={s.l} style={{ ...CARD, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.c, lineHeight: 1, marginBottom: 4 }}>{s.v}</div>
            <div style={{ fontSize: 13, color: '#6E6E73', fontWeight: 500 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: '-0.02em' }}>Workload Distribution</div>
          {[{ l: 'Heavy', c: '#FF3B30', n: wlC.heavy }, { l: 'Medium', c: '#FF9500', n: wlC.medium }, { l: 'Light', c: '#34C759', n: wlC.light }].map(row => (
            <div key={row.l} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: row.c, display: 'inline-block' }} />{row.l}</span>
                <span style={{ fontWeight: 600, color: row.c }}>{row.n} <span style={{ color: '#AEAEB2', fontWeight: 400 }}>({myE.length ? Math.round(row.n / myE.length * 100) : 0}%)</span></span>
              </div>
              <div style={{ height: 5, background: '#F2F2F7', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${myE.length ? row.n / myE.length * 100 : 0}%`, background: row.c, borderRadius: 9999 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: '-0.02em' }}>Task Outcomes</div>
          {allTasks.length === 0
            ? <div style={{ color: '#AEAEB2', fontSize: 13, textAlign: 'center', paddingTop: 20 }}>No task data yet.</div>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(Object.entries(TASK_STATUS) as [TaskStatus, typeof TASK_STATUS[TaskStatus]][]).map(([key, s]) => {
                  const count = allTasks.filter(t => t.status === key).length
                  if (!count) return null
                  return (
                    <div key={key} style={{ flex: '1 0 calc(50% - 4px)', background: s.bg, borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.03em' }}>{count}</div>
                      <div style={{ fontSize: 11, color: s.color, marginTop: 2, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  )
                })}
              </div>
          }
        </div>
      </div>

      {projBreak.length > 0 && (
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Project Breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
            {projBreak.map(([pid, hrs]) => {
              const proj = projects.find(p => p.id === pid)
              const color = proj?.color || '#AEAEB2'
              const name = pid === '__other__' ? 'Other Work' : (proj?.name || pid)
              return (
                <div key={pid} style={{ padding: '6px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontWeight: 500, color: '#1D1D1F' }}>{name}</span>
                    </span>
                    <span style={{ color: '#6E6E73', fontWeight: 600 }}>{hrs > 0 ? hrs.toFixed(1) + 'h' : '—'}</span>
                  </div>
                  <div style={{ height: 4, background: '#F2F2F7', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(hrs / maxH) * 100}%`, background: color, borderRadius: 9999 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main EmployeePage ─────────────────────────────────────────────────────────
export default function EmployeePage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<'update' | 'stats'>('update')
  const [todayEntry, setTodayEntry] = useState<Entry | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [tasks, setTasks] = useState<LocalTask[]>([mkTask()])
  const [workload, setWorkload] = useState<Workload>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [broadcast, setBroadcast] = useState<{ message: string; active: boolean } | null>(null)
  const [broadcastDismissed, setBroadcastDismissed] = useState(false)
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const today = TODAY()
      const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const [eRes, pRes, bRes, hRes] = await Promise.all([
        fetch(`/api/entries?today=${today}&employee_id=${session.id}`),
        fetch('/api/projects'),
        fetch('/api/broadcast'),
        fetch(`/api/entries?employee_id=${session.id}&from=${from}&to=${today}`),
      ])
      const [eData, pData, bData, hData] = await Promise.all([eRes.json(), pRes.json(), bRes.json(), hRes.json()])
      const todayEnt: Entry | null = eData.entries?.[0] || null
      const historyEnts: Entry[] = hData.entries || []
      setTodayEntry(todayEnt)
      setProjects(pData.projects || [])
      if (bData.active) setBroadcast(bData)
      setEntries(historyEnts)

      const allEntries = [...(todayEnt ? [todayEnt] : []), ...historyEnts]
      if (allEntries.length > 0) {
        const commentResults = await Promise.all(
          allEntries.map(e => fetch(`/api/comments?entry_id=${e.id}`).then(r => r.json()))
        )
        const map: Record<string, Comment[]> = {}
        allEntries.forEach((e, i) => { map[e.id] = commentResults[i].comments || [] })
        setCommentsMap(map)
      }
    } catch {
      setError('Failed to load data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [session.id])

  useEffect(() => { fetchData() }, [fetchData])

  function updateTask(i: number, field: keyof LocalTask, value: string | boolean) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }
  function toggleStatus(i: number) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, status: t.status === 'completed' ? 'in_progress' : 'completed' } : t))
  }
  function toggleBlockers(i: number) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, showBlockers: !t.showBlockers } : t))
  }
  function addTask() { setTasks(prev => [...prev, mkTask()]) }
  function removeTask(i: number) { setTasks(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleSubmit() {
    const validTasks = tasks.filter(t => t.task.trim()).map(toProjectTask)
    if (validTasks.length === 0) { setError('Add at least one task.'); return }
    setSubmitting(true); setError('')
    try {
      if (editMode && todayEntry) {
        const res = await fetch('/api/entries', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: todayEntry.id, project_tasks: validTasks, workload, submit_count: (todayEntry.submit_count || 1) + 1 })
        })
        if (!res.ok) { const d = await res.json(); setError(d.error || 'Update failed.'); return }
      } else {
        const res = await fetch('/api/entries', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    setTasks(todayEntry.project_tasks?.length ? todayEntry.project_tasks.map(toLocalTask) : [mkTask()])
    setWorkload(todayEntry.workload)
    setEditMode(true)
  }

  const today = TODAY()
  const hasSubmitted = !!todayEntry && !editMode
  const myProj = projects.filter(p => p.status === 'active' && (p.members?.includes(session.id) || p.lead === session.id))
  const otherProj = projects.filter(p => p.status === 'active' && !p.members?.includes(session.id) && p.lead !== session.id)

  return (
    <div style={{ minHeight: '100vh', fontFamily: FONT }}>
      {/* NavBar */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/meril-logo.svg" alt="Meril" style={{ height: 20, width: 'auto', display: 'block' }} />
          <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.12)' }} />
          <span className="navbar-title">Daily Tracker</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" style={{ background: 'rgba(0,113,227,0.1)', color: '#0071E3', fontSize: 13 }}>
            {session.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>{session.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={onLogout}>Logout</button>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
        {/* Broadcast */}
        {!broadcastDismissed && broadcast?.active && broadcast.message && (
          <div className="broadcast-banner">
            <span className="broadcast-banner-icon">!</span>
            <div style={{ flex: 1 }}>
              <div className="broadcast-banner-label">Manager Announcement</div>
              <div className="broadcast-banner-text">{broadcast.message}</div>
            </div>
            <button onClick={() => setBroadcastDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', fontSize: 20, lineHeight: 1, flexShrink: 0, padding: '0 4px', fontFamily: FONT }}>×</button>
          </div>
        )}

        {/* iOS Segmented tab bar */}
        <div style={{ display: 'flex', gap: 6, background: '#F2F2F7', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
          {[['update', 'My Update'], ['stats', 'My Stats']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as 'update' | 'stats')}
              style={{ padding: '8px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', background: tab === id ? 'white' : 'transparent', color: tab === id ? '#1D1D1F' : '#6E6E73', fontWeight: tab === id ? 600 : 400, fontSize: 14, fontFamily: FONT, boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all .15s' }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}><div className="spinner" style={{ width: 28, height: 28, margin: '0 auto' }} /></div>
        ) : tab === 'stats' ? (
          <MyStats entries={entries} projects={projects} />
        ) : (
          /* ── MY UPDATE TAB ── */
          <div>
            {/* Submitted state */}
            {hasSubmitted && (
              <div>
                <div style={{ ...CARD, padding: '28px 24px', textAlign: 'center', marginBottom: 16, background: (todayEntry.submit_count || 1) >= 2 ? 'linear-gradient(135deg,#F0FFF4,#F6FFFA)' : 'linear-gradient(135deg,#EFF6FF,#F5F9FF)', border: (todayEntry.submit_count || 1) >= 2 ? '1px solid rgba(52,199,89,0.2)' : '1px solid rgba(0,113,227,0.15)' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: (todayEntry.submit_count || 1) >= 2 ? 'rgba(52,199,89,0.15)' : 'rgba(0,113,227,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 24 }}>✓</div>
                  <h3 style={{ color: (todayEntry.submit_count || 1) >= 2 ? '#1A6B31' : '#003D82', fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', marginBottom: 6 }}>
                    {(todayEntry.submit_count || 1) >= 2 ? "Today's update finalised" : "Today's update submitted"}
                  </h3>
                  <p style={{ color: (todayEntry.submit_count || 1) >= 2 ? '#2D8A45' : '#0062C4', fontSize: 14 }}>
                    {(todayEntry.submit_count || 1) >= 2 ? `Final submission for ${FMT_DATE(today)}.` : `Submitted for ${FMT_DATE(today)}. You may edit this once more.`}
                  </p>
                  {(todayEntry.submit_count || 1) < 2 && (
                    <button onClick={startEdit} style={{ marginTop: 16, padding: '8px 20px', background: 'white', border: '1.5px solid #0071E3', color: '#0071E3', borderRadius: 980, fontSize: 14, fontWeight: 590, cursor: 'pointer', fontFamily: FONT }}>Edit & Resubmit</button>
                  )}
                </div>
                <TaskDisplay tasks={todayEntry.project_tasks} projects={projects} />
                <ManagerNotes comments={commentsMap[todayEntry.id] || []} />
              </div>
            )}

            {/* Form (new or edit) */}
            {(!hasSubmitted || editMode) && (
              <div style={{ ...CARD, padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', letterSpacing: '-0.02em' }}>
                  <div>
                    <span>{editMode ? "Update Today's Work" : "Today's Work"}</span>
                    <div style={{ fontSize: 13, fontWeight: 400, color: '#AEAEB2', marginTop: 2 }}>{FMT_DATE(today)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 400, color: '#AEAEB2' }}>{myProj.length} project{myProj.length !== 1 ? 's' : ''}</span>
                    {editMode && <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(false)}>Cancel</button>}
                  </div>

                </div>

                {editMode && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14, background: 'rgba(255,149,0,0.08)', color: '#B25900', border: '1px solid rgba(255,149,0,0.2)', fontWeight: 500 }}>
                    This is your <strong>final resubmission</strong> for today.
                  </div>
                )}

                {error && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 14, marginBottom: 14, background: 'rgba(255,59,48,0.08)', color: '#CC0000', border: '1px solid rgba(255,59,48,0.15)' }}>{error}</div>
                )}

                {/* v4 Task rows */}
                <div style={{ marginBottom: 8 }}>
                  {tasks.map((t, idx) => {
                    const proj = projects.find(p => p.id === t.project_id)
                    const si = TASK_STATUS[t.status] || TASK_STATUS.in_progress
                    return (
                      <div key={t.uid} style={{ background: 'white', borderRadius: 12, marginBottom: 8, border: `1px solid ${proj ? proj.color + '22' : 'rgba(0,0,0,0.07)'}`, borderLeft: `3px solid ${proj?.color || 'rgba(0,0,0,0.15)'}`, overflow: 'hidden' }}>
                        {/* Row 1: circle • task text • time • remove */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 12px 0' }}>
                          <div
                            onClick={() => toggleStatus(idx)}
                            style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${si.color}`, background: t.status === 'completed' ? si.color : 'transparent', flexShrink: 0, marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            {t.status === 'completed' && <span style={{ color: 'white', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                          </div>
                          <input
                            type="text"
                            value={t.task}
                            onChange={e => updateTask(idx, 'task', e.target.value)}
                            placeholder={`Task ${idx + 1}  What did you work on?`}
                            style={{ flex: 1, border: 'none', fontSize: 14, fontFamily: FONT, outline: 'none', background: 'transparent', color: '#1D1D1F', padding: '0 0 0 8px', boxSizing: 'border-box', height: 28, boxShadow: 'none' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, paddingTop: 2 }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={t.time}
                              onChange={e => {
                                const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
                                if (v === '' || v === '.' || (parseFloat(v) >= 0 && parseFloat(v) <= 24)) updateTask(idx, 'time', v)
                              }}
                              placeholder="0h"
                              style={{ width: 44, padding: '4px 6px', border: 'none', borderRadius: 6, background: '#F5F5F7', fontSize: 12, outline: 'none', textAlign: 'center', color: '#6E6E73', boxSizing: 'border-box', fontFamily: FONT, boxShadow: 'none' }}
                            />
                            {tasks.length > 1 && (
                              <button onClick={() => removeTask(idx)} style={{ width: 24, height: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', padding: 0, lineHeight: 1, fontFamily: FONT }}>×</button>
                            )}
                          </div>
                        </div>

                        {/* Row 2: project pill • status pill • blocker toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 10px 44px', flexWrap: 'wrap' }}>
                          <select
                            value={t.project_id}
                            onChange={e => updateTask(idx, 'project_id', e.target.value)}
                            style={{ width: 'auto', padding: '4px 22px 4px 8px', fontSize: 12, borderRadius: 980, border: `1px solid ${proj ? proj.color + '40' : 'rgba(0,0,0,0.12)'}`, background: proj ? proj.color + '15' : '#F5F5F7', color: proj?.color || '#6E6E73', fontFamily: FONT, outline: 'none', fontWeight: 600, cursor: 'pointer', maxWidth: 160, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%236E6E73' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center', appearance: 'none', WebkitAppearance: 'none', boxShadow: 'none' }}
                          >
                            <option value="">— Project —</option>
                            {myProj.length > 0 && <optgroup label="My Projects">{myProj.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                            {otherProj.length > 0 && <optgroup label="Other Projects">{otherProj.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                            <optgroup label="General"><option value="__other__">Other Work</option></optgroup>
                          </select>

                          <select
                            value={t.status}
                            onChange={e => {
                              const s = e.target.value as TaskStatus
                              updateTask(idx, 'status', s)
                              if (s === 'blocked') setTasks(prev => prev.map((tk, i) => i === idx ? { ...tk, showBlockers: true } : tk))
                            }}
                            style={{ width: 'auto', padding: '4px 22px 4px 8px', fontSize: 12, borderRadius: 980, border: `1px solid ${si.color}40`, background: `${si.color}15`, color: si.color, fontFamily: FONT, outline: 'none', fontWeight: 600, cursor: 'pointer', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%236E6E73' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center', appearance: 'none', WebkitAppearance: 'none', boxShadow: 'none' }}
                          >
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="blocked">Blocked</option>
                            <option value="carried">Carried →</option>
                          </select>

                          <button onClick={() => toggleBlockers(idx)} style={{ fontSize: 12, color: t.showBlockers ? '#FF9500' : '#AEAEB2', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: FONT, fontWeight: 500 }}>
                            {t.showBlockers ? '− Blocker' : '+ Blocker'}
                          </button>
                        </div>

                        {/* Row 3: blocker textarea */}
                        {t.showBlockers && (
                          <div style={{ padding: '0 12px 12px 44px' }}>
                            <textarea
                              value={t.blockers}
                              onChange={e => updateTask(idx, 'blockers', e.target.value)}
                              placeholder="Describe the blocker…"
                              rows={2}
                              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid rgba(255,149,0,0.35)', borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: 'none', resize: 'none', background: 'rgba(255,149,0,0.04)', boxSizing: 'border-box', lineHeight: 1.5, color: '#B25900', boxShadow: 'none' }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add task button (dashed) */}
                  <button onClick={addTask} style={{ width: '100%', padding: '11px 12px', background: 'none', border: '1.5px dashed rgba(0,113,227,0.3)', borderRadius: 10, color: '#0071E3', fontSize: 14, cursor: 'pointer', fontFamily: FONT, fontWeight: 500, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    + Add task
                  </button>
                </div>

                {/* Workload selector */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#6E6E73', marginBottom: 10, display: 'block', letterSpacing: '-0.01em' }}>Overall workload today</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['light', 'medium', 'heavy'] as Workload[]).map(w => {
                      const wl = WL[w]
                      const active = workload === w
                      return (
                        <button key={w} onClick={() => setWorkload(w)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${active ? wl.color : 'rgba(0,0,0,0.1)'}`, background: active ? wl.bg : 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, color: active ? wl.color : '#6E6E73', transition: 'all .15s', textAlign: 'center' }}>
                          {wl.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: '13px 22px', background: '#0071E3', color: 'white', border: 'none', borderRadius: 980, fontSize: 17, fontWeight: 590, fontFamily: FONT, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, letterSpacing: '-0.01em', transition: 'opacity .12s' }}>
                  {submitting ? 'Submitting…' : editMode ? 'Update Submission' : "Submit Today's Update"}
                </button>
              </div>
            )}

            {/* Recent history */}
            {entries.filter(e => e.date !== today).slice(0, 5).length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Recent Updates</div>
                {entries.filter(e => e.date !== today).slice(0, 5).map(entry => (
                  <div key={entry.id} style={{ ...CARD, padding: '16px 20px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: '#AEAEB2' }}>{FMT_DATE(entry.date)}</div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 980, fontSize: 12, fontWeight: 600, background: WL[entry.workload].bg, color: WL[entry.workload].color }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: WL[entry.workload].color, flexShrink: 0, display: 'inline-block' }} />{WL[entry.workload].label}
                      </span>
                    </div>
                    {entry.is_absent
                      ? <div style={{ color: '#AEAEB2', fontSize: 13, fontStyle: 'italic' }}>Marked absent for this day.</div>
                      : <TaskDisplay tasks={entry.project_tasks} projects={projects} />
                    }
                    <ManagerNotes comments={commentsMap[entry.id] || []} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
