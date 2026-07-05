'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Entry, Employee, Project, ProjectTask, Workload, Session, Comment } from '@/lib/types'
import { FONT, CARD } from '@/lib/ui'
import EntryRow from './EntryRow'

import { todayIST } from '@/lib/dates'

const TODAY = todayIST

function emptyMgrTask(): { uid: number; project_id: string; task: string; time: string; status: 'in_progress' | 'completed' | 'blocked'; blockers: string } {
  return { uid: Date.now() + Math.random(), project_id: '', task: '', time: '', status: 'in_progress', blockers: '' }
}

function SubmitOnBehalfModal({ employee, projects, onClose, onDone }: {
  employee: Employee; projects: Project[]; onClose: () => void; onDone: () => void
}) {
  const [tasks, setTasks] = useState<(ProjectTask & { uid: number })[]>([{ uid: Date.now(), project_id: '', task: '', time: '', status: 'in_progress', blockers: '' }])
  const [workload, setWorkload] = useState<Workload>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateTask(uid: number, field: keyof ProjectTask, value: string) {
    setTasks(prev => prev.map(t => t.uid === uid ? { ...t, [field]: value } : t))
  }

  async function handleSubmit() {
    const valid = tasks.filter(t => t.task.trim())
    if (!valid.length) { setError('Add at least one task.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employee.id, employee_name: employee.name, date: TODAY(), workload, project_tasks: valid.map(({ uid, ...t }) => t), submitted_by_manager: true })
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return }
      onDone()
    } catch { setError('Connection error.') } finally { setSubmitting(false) }
  }

  const WL_COLORS: Record<Workload, string> = { light: '#34C759', medium: '#FF9500', heavy: '#FF3B30' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px 16px' }}>
      <div style={{ background: 'white', borderRadius: 20, maxWidth: 520, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 16, fontFamily: FONT }}>Submit for {employee.name}</div>
          <button onClick={onClose} style={{ width: 28, height: 28, background: '#F5F5F7', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 18, color: '#6E6E73', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {error && <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#FF3B30', marginBottom: 12, fontFamily: FONT }}>{error}</div>}
          {tasks.map(t => (
            <div key={t.uid} style={{ background: '#F5F5F7', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 60px', gap: 8, marginBottom: 8 }}>
                <select value={t.project_id} onChange={e => updateTask(t.uid, 'project_id', e.target.value)}
                  style={{ padding: '7px 10px', fontSize: 13, borderRadius: 7, border: 'none', fontFamily: FONT, background: 'white', outline: 'none' }}>
                  <option value="">No project</option>
                  {projects.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={t.status} onChange={e => updateTask(t.uid, 'status', e.target.value)}
                  style={{ padding: '7px 8px', fontSize: 12, borderRadius: 7, border: 'none', fontFamily: FONT, background: 'white', outline: 'none' }}>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Done</option>
                  <option value="blocked">Blocked</option>
                </select>
                <input type="text" value={t.time} onChange={e => updateTask(t.uid, 'time', e.target.value)}
                  placeholder="3h" style={{ padding: '7px 8px', fontSize: 13, borderRadius: 7, border: 'none', fontFamily: FONT, background: 'white', outline: 'none' }} />
              </div>
              <textarea value={t.task} onChange={e => updateTask(t.uid, 'task', e.target.value)}
                placeholder="Task description…" rows={2}
                style={{ width: '100%', padding: '8px 10px', border: 'none', borderRadius: 7, fontSize: 13, fontFamily: FONT, resize: 'none', boxSizing: 'border-box', background: 'white', outline: 'none', lineHeight: 1.5 }} />
            </div>
          ))}
          <button onClick={() => setTasks(prev => [...prev, { uid: Date.now(), project_id: '', task: '', time: '', status: 'in_progress', blockers: '' }])}
            style={{ fontSize: 12, color: '#33398a', background: 'none', border: '1px dashed rgba(51,57,138,0.35)', borderRadius: 7, cursor: 'pointer', padding: '5px 10px', fontFamily: FONT, marginBottom: 14 }}>
            + Add Task
          </button>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontFamily: FONT }}>Workload</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['light', 'medium', 'heavy'] as Workload[]).map(w => (
                <button key={w} onClick={() => setWorkload(w)}
                  style={{ flex: 1, padding: '8px', borderRadius: 980, fontSize: 13, fontWeight: 590, cursor: 'pointer', fontFamily: FONT, border: 'none', background: workload === w ? WL_COLORS[w] : '#F5F5F7', color: workload === w ? 'white' : '#6E6E73', transition: 'all 0.12s' }}>
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ width: '100%', padding: '12px', background: '#33398a', color: 'white', border: 'none', borderRadius: 980, fontSize: 15, fontWeight: 590, cursor: 'pointer', fontFamily: FONT }}>
            {submitting ? 'Submitting…' : 'Submit on Behalf'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TodayTab({ managerSession }: { managerSession: Session }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [loading, setLoading] = useState(true)
  const [statFilter, setStatFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [showMgrUpdate, setShowMgrUpdate] = useState(false)
  const [mgrTasks, setMgrTasks] = useState([emptyMgrTask()])
  const [mgrWl, setMgrWl] = useState<Workload>('medium')
  const [submittingMgr, setSubmittingMgr] = useState(false)
  const [submitBehalfEmp, setSubmitBehalfEmp] = useState<Employee | null>(null)

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
    } catch { } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function onExpand(entryId: string) {
    if (comments[entryId] !== undefined) return
    try {
      const res = await fetch(`/api/comments?entry_id=${entryId}`)
      const d = await res.json()
      setComments(prev => ({ ...prev, [entryId]: d.comments || [] }))
    } catch { setComments(prev => ({ ...prev, [entryId]: [] })) }
  }

  async function handleAddComment(entryId: string, text: string) {
    await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry_id: entryId, text, author: 'manager' }) })
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
    const res = await fetch('/api/entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: emp.id, employee_name: emp.name, date: TODAY(), workload: 'light', is_absent: true, project_tasks: [], submitted_by_manager: true })
    })
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Failed to mark absent.'); return }
    load()
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return
    await fetch(`/api/entries?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function submitMgrUpdate() {
    const valid = mgrTasks.filter(t => t.task.trim())
    if (!valid.length) return
    setSubmittingMgr(true)
    try {
      await fetch('/api/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: managerSession.id, employee_name: managerSession.name, date: TODAY(), workload: mgrWl, project_tasks: valid.map(({ uid, ...t }) => t), submitted_by_manager: false })
      })
      setShowMgrUpdate(false)
      setMgrTasks([emptyMgrTask()])
      load()
    } finally { setSubmittingMgr(false) }
  }

  const nonMgrEmps = employees.filter(e => e.role === 'employee')
  const mgrEntry = entries.find(e => e.employee_id === managerSession.id && !e.is_absent)
  const empEntryMap = Object.fromEntries(
    entries.filter(e => nonMgrEmps.some(emp => emp.id === e.employee_id)).map(e => [e.employee_id, e])
  )
  const submitted = nonMgrEmps.filter(e => empEntryMap[e.id] && !empEntryMap[e.id].is_absent)
  const missing = nonMgrEmps.filter(e => !empEntryMap[e.id])
  const heavy = submitted.filter(e => empEntryMap[e.id]?.workload === 'heavy')
  const medium = submitted.filter(e => empEntryMap[e.id]?.workload === 'medium')
  const light = submitted.filter(e => empEntryMap[e.id]?.workload === 'light')

  const activeFilter = statFilter || nameFilter
  let displayEntries = Object.values(empEntryMap).filter(e => !e.is_absent)
  if (statFilter === 'heavy') displayEntries = displayEntries.filter(e => e.workload === 'heavy')
  else if (statFilter === 'medium') displayEntries = displayEntries.filter(e => e.workload === 'medium')
  else if (statFilter === 'light') displayEntries = displayEntries.filter(e => e.workload === 'light')
  if (nameFilter) displayEntries = displayEntries.filter(e => e.employee_id === nameFilter)
  displayEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const stats = [
    { id: 'submitted', label: 'Submitted', value: submitted.length, color: '#34C759' },
    { id: 'pending', label: 'Pending', value: missing.length, color: '#FF9500' },
    { id: 'heavy', label: 'Heavy', value: heavy.length, color: '#FF3B30' },
    { id: 'medium', label: 'Medium', value: medium.length, color: '#FF9500' },
    { id: 'light', label: 'Light', value: light.length, color: '#34C759' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #F2F2F7', borderTopColor: '#33398a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div>
      {/* Stat card filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
        {stats.map(s => (
          <div key={s.id} onClick={() => setStatFilter(f => f === s.id ? '' : s.id)}
            style={{ ...CARD, padding: '14px 12px', cursor: 'pointer', textAlign: 'center', transition: 'opacity 0.15s, box-shadow 0.15s', opacity: activeFilter && statFilter !== s.id ? 0.45 : 1, boxShadow: statFilter === s.id ? `0 0 0 2px ${s.color}, 0 4px 20px rgba(0,0,0,0.1)` : '0 1px 0 rgba(0,0,0,0.04), 0 2px 16px rgba(0,0,0,0.05)' }}>
            <div style={{ fontWeight: 700, fontSize: 22, color: s.color, fontFamily: FONT, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#AEAEB2', fontFamily: FONT, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ ...CARD, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={nameFilter} onChange={e => setNameFilter(e.target.value)}
          style={{ flex: 1, minWidth: 150, padding: '8px 12px', fontSize: 13, borderRadius: 8, border: 'none', background: '#F5F5F7', fontFamily: FONT, outline: 'none', color: '#1D1D1F' }}>
          <option value="">All Employees</option>
          {nonMgrEmps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {activeFilter && (
          <button onClick={() => { setStatFilter(''); setNameFilter('') }}
            style={{ fontSize: 13, color: '#33398a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap', padding: '4px 0' }}>
            Clear filters ×
          </button>
        )}
      </div>

      {/* Manager's own update prompt */}
      {!mgrEntry && (
        <div style={{ ...CARD, padding: '11px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#6E6E73', fontFamily: FONT }}>You haven&apos;t logged your own update today.</span>
          <button onClick={() => setShowMgrUpdate(v => !v)}
            style={{ fontSize: 13, color: '#33398a', background: 'none', border: '1px solid rgba(51,57,138,0.25)', borderRadius: 8, cursor: 'pointer', padding: '5px 12px', fontFamily: FONT, fontWeight: 500 }}>
            {showMgrUpdate ? 'Cancel' : 'Add my update'}
          </button>
        </div>
      )}
      {mgrEntry && (
        <div style={{ ...CARD, padding: '10px 18px', marginBottom: 12, borderLeft: '3px solid #34C759', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#1A6B31', fontWeight: 500, fontFamily: FONT }}>Your update is logged for today.</span>
        </div>
      )}

      {/* Manager update form */}
      {showMgrUpdate && !mgrEntry && (
        <div style={{ ...CARD, padding: '16px 18px', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, fontFamily: FONT }}>My Update — {TODAY()}</div>
          {mgrTasks.map(t => (
            <div key={t.uid} style={{ background: '#F5F5F7', borderRadius: 10, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <select value={t.project_id} onChange={e => setMgrTasks(prev => prev.map(x => x.uid === t.uid ? { ...x, project_id: e.target.value } : x))}
                  style={{ flex: 2, minWidth: 120, padding: '7px 10px', fontSize: 13, borderRadius: 7, border: 'none', fontFamily: FONT, background: 'white', outline: 'none' }}>
                  <option value="">— Project —</option>
                  {projects.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  <option value="__other__">Other Work</option>
                </select>
                <select value={t.status} onChange={e => setMgrTasks(prev => prev.map(x => x.uid === t.uid ? { ...x, status: e.target.value as 'in_progress' | 'completed' | 'blocked' } : x))}
                  style={{ padding: '7px 10px', fontSize: 12, borderRadius: 7, border: 'none', fontFamily: FONT, background: 'white', outline: 'none' }}>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="blocked">Blocked</option>
                </select>
                <input type="text" value={t.time} onChange={e => setMgrTasks(prev => prev.map(x => x.uid === t.uid ? { ...x, time: e.target.value } : x))}
                  placeholder="3h" style={{ width: 56, padding: '7px 10px', fontSize: 13, borderRadius: 7, border: 'none', fontFamily: FONT, background: 'white', outline: 'none' }} />
              </div>
              <textarea value={t.task} onChange={e => setMgrTasks(prev => prev.map(x => x.uid === t.uid ? { ...x, task: e.target.value } : x))}
                placeholder="What did you work on?" rows={2}
                style={{ width: '100%', padding: '8px 10px', border: 'none', borderRadius: 7, fontSize: 13, fontFamily: FONT, resize: 'vertical', boxSizing: 'border-box', background: 'white', lineHeight: 1.5, outline: 'none' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setMgrTasks(prev => [...prev, emptyMgrTask()])}
              style={{ fontSize: 12, color: '#33398a', background: 'none', border: '1px dashed rgba(51,57,138,0.35)', borderRadius: 7, cursor: 'pointer', padding: '5px 10px', fontFamily: FONT }}>
              + project
            </button>
            <select value={mgrWl} onChange={e => setMgrWl(e.target.value as Workload)}
              style={{ padding: '5px 10px', fontSize: 12, borderRadius: 7, border: 'none', background: '#F5F5F7', fontFamily: FONT, outline: 'none' }}>
              <option value="light">Light</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy</option>
            </select>
            <button onClick={submitMgrUpdate} disabled={submittingMgr}
              style={{ padding: '7px 16px', background: '#33398a', color: 'white', border: 'none', borderRadius: 980, fontSize: 13, fontWeight: 590, cursor: 'pointer', fontFamily: FONT }}>
              {submittingMgr ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {/* Yet to Submit banner */}
      {missing.length > 0 && !activeFilter && (
        <div style={{ ...CARD, padding: '16px 20px', marginBottom: 16, borderLeft: '3px solid #FF9500' }}>
          <div style={{ fontWeight: 600, color: '#B25900', marginBottom: 12, fontSize: 14, fontFamily: FONT }}>Yet to Submit ({missing.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {missing.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ padding: '4px 10px', borderRadius: 980, fontSize: 13, fontWeight: 500, background: 'rgba(255,59,48,0.08)', color: '#FF3B30', fontFamily: FONT }}>{e.name}</span>
                <button onClick={() => markAbsent(e)}
                  style={{ padding: '3px 8px', background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#6E6E73', fontFamily: FONT }}>
                  Absent
                </button>
                <button onClick={() => setSubmitBehalfEmp(e)}
                  style={{ padding: '3px 8px', background: 'rgba(51,57,138,0.08)', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#33398a', fontFamily: FONT }}>
                  Submit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {missing.length === 0 && !activeFilter && (
        <div style={{ ...CARD, padding: '14px 20px', marginBottom: 16, borderLeft: '3px solid #34C759' }}>
          <div style={{ color: '#1A6B31', fontWeight: 600, fontSize: 14, fontFamily: FONT }}>All team members have submitted today ✓</div>
        </div>
      )}

      {/* Entries list */}
      <div>
        {displayEntries.map(e => (
          <EntryRow
            key={e.id}
            entry={e}
            showName
            projects={projects}
            isManager
            comments={comments[e.id]}
            onAddComment={handleAddComment}
            reviewed={reviewedIds.has(e.id)}
            onToggleReviewed={toggleReviewed}
            onDelete={deleteEntry}
            onExpand={onExpand}
          />
        ))}
        {displayEntries.length === 0 && statFilter !== 'pending' && activeFilter && (
          <div style={{ ...CARD, padding: '48px 20px', textAlign: 'center', color: '#AEAEB2', fontFamily: FONT, fontSize: 14 }}>
            No entries match the current filter.
          </div>
        )}
      </div>

      {submitBehalfEmp && (
        <SubmitOnBehalfModal
          employee={submitBehalfEmp}
          projects={projects}
          onClose={() => setSubmitBehalfEmp(null)}
          onDone={() => { setSubmitBehalfEmp(null); load() }}
        />
      )}
    </div>
  )
}
