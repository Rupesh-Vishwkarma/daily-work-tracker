'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Project, Employee, Entry } from '@/lib/types'
import { FONT, CARD, fmtDate } from '@/lib/ui'

const TODAY = new Date().toISOString().slice(0, 10)
const COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6']

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
}

export default function ProjectsTab() {
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [expandedArchive, setExpandedArchive] = useState<string | null>(null)
  const [newProj, setNewProj] = useState({ name: '', lead: '', members: [] as string[], startDate: TODAY, deadline: '', color: '#6366F1' })
  const [saving, setSaving] = useState(false)
  const [extendPid, setExtendPid] = useState<string | null>(null)
  const [extendDate, setExtendDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, e, ents] = await Promise.all([
        fetch('/api/projects').then(r => r.json()),
        fetch('/api/employees').then(r => r.json()),
        fetch(`/api/entries?from=2024-01-01&to=${TODAY}`).then(r => r.json()),
      ])
      setProjects(p.projects || [])
      setEmployees(e.employees || [])
      setEntries(ents.entries || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const emps = useMemo(() => employees.filter(e => e.role === 'employee'), [employees])
  const active = projects.filter(p => p.status === 'active')
  const archived = projects.filter(p => p.status === 'closed')

  const projectStats = useMemo(() => {
    const parseH = (t: string) => parseFloat((t || '0').replace(/[^\d.]/g, '')) || 0
    const map: Record<string, { todayCount: number; totalCount: number; lastActivity: string; totalHours: number; contrib: { name: string; entries: number; time: number }[] }> = {}
    projects.forEach(p => {
      const pid = p.id
      const pe = entries.filter(e => (e.project_tasks || []).some(t => t.project_id === pid))
      const dates = pe.map(e => e.date).sort()
      const hours = pe.reduce((s, e) => s + (e.project_tasks || []).filter(t => t.project_id === pid).reduce((ss, t) => ss + parseH(t.time), 0), 0)
      const contrib = emps.map(emp => {
        const ee = pe.filter(e => e.employee_id === emp.id)
        if (!ee.length) return null
        const h = ee.reduce((s, e) => s + (e.project_tasks || []).filter(t => t.project_id === pid).reduce((ss, t) => ss + parseH(t.time), 0), 0)
        return { name: emp.name, entries: ee.length, time: h }
      }).filter(Boolean).sort((a, b) => b!.time - a!.time) as { name: string; entries: number; time: number }[]
      map[pid] = {
        todayCount: pe.filter(e => e.date === TODAY).length,
        totalCount: pe.length,
        lastActivity: dates.length ? fmtDate(dates[dates.length - 1]) : '—',
        totalHours: hours,
        contrib,
      }
    })
    return map
  }, [projects, entries, emps])

  const todayCount = (pid: string) => projectStats[pid]?.todayCount ?? 0
  const totalCount = (pid: string) => projectStats[pid]?.totalCount ?? 0
  const lastActivity = (pid: string) => projectStats[pid]?.lastActivity ?? '—'
  const totalHours = (pid: string) => projectStats[pid]?.totalHours ?? 0
  const contribFor = (pid: string) => projectStats[pid]?.contrib ?? []

  const selProj = selected ? projects.find(p => p.id === selected) : null
  const selEntries = selected ? entries.filter(e => (e.project_tasks || []).some(t => t.project_id === selected)).sort((a, b) => b.date.localeCompare(a.date)) : []

  const overdueActive = active.filter(p => p.deadline && p.deadline < TODAY)
  const soonActive = active.filter(p => p.deadline && p.deadline >= TODAY && Math.ceil((new Date(p.deadline + 'T12:00:00').getTime() - new Date(TODAY + 'T12:00:00').getTime()) / 86400000) <= 7)

  function toggleMember(id: string) {
    setNewProj(p => ({ ...p, members: p.members.includes(id) ? p.members.filter(m => m !== id) : [...p.members, id] }))
  }

  async function addProject() {
    if (!newProj.name.trim()) return
    setSaving(true)
    try {
      const id = slugify(newProj.name) || `proj${Date.now()}`
      const lead = newProj.lead || emps[0]?.id
      const members = [...new Set([lead, ...newProj.members].filter(Boolean))]
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: newProj.name.trim(), color: newProj.color, lead, members, start_date: newProj.startDate, deadline: newProj.deadline || null })
      })
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Failed to create project.'); return }
      setShowAdd(false)
      setNewProj({ name: '', lead: '', members: [], startDate: TODAY, deadline: '', color: '#6366F1' })
      load()
    } finally { setSaving(false) }
  }

  async function archiveProject(pid: string) {
    if (!confirm('Mark this project as complete?')) return
    await fetch('/api/projects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pid, status: 'closed', end_date: TODAY }) })
    if (selected === pid) setSelected(null)
    load()
  }

  async function extendDeadline(pid: string) {
    if (!extendDate) return
    const proj = projects.find(p => p.id === pid)
    const prev = [...(proj?.previous_deadlines || []), proj?.deadline].filter(Boolean)
    await fetch('/api/projects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pid, deadline: extendDate, previous_deadlines: prev }) })
    setExtendPid(null); setExtendDate('')
    load()
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #F2F2F7', borderTopColor: '#0071E3', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div>
      {/* Deadline alerts */}
      {(overdueActive.length > 0 || soonActive.length > 0) && (
        <div style={{ background: overdueActive.length > 0 ? 'rgba(255,59,48,0.05)' : 'rgba(255,149,0,0.05)', border: `1px solid ${overdueActive.length > 0 ? 'rgba(255,59,48,0.2)' : 'rgba(255,149,0,0.2)'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontFamily: FONT }}>
          {overdueActive.length > 0 && <div style={{ fontSize: 13, color: '#FF3B30', fontWeight: 600, marginBottom: soonActive.length > 0 ? 4 : 0 }}>{overdueActive.length} project{overdueActive.length !== 1 ? 's' : ''} overdue: {overdueActive.map(p => p.name).join(', ')}</div>}
          {soonActive.length > 0 && <div style={{ fontSize: 13, color: '#B25900', fontWeight: 500 }}>{soonActive.length} due within 7 days: {soonActive.map(p => p.name).join(', ')}</div>}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 22, color: '#1D1D1F', fontFamily: FONT, letterSpacing: '-0.02em' }}>Projects</div>
        <button onClick={() => setShowAdd(v => !v)}
          style={{ padding: '8px 18px', background: '#0071E3', color: 'white', border: 'none', borderRadius: 980, fontSize: 13, cursor: 'pointer', fontWeight: 590, fontFamily: FONT }}>
          {showAdd ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {/* New project inline form */}
      {showAdd && (
        <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16, fontFamily: FONT }}>New Project</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block', fontFamily: FONT }}>Name</label>
              <input type="text" value={newProj.name} onChange={e => setNewProj(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Merilverse"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', background: '#F5F5F7', fontSize: 14, fontFamily: FONT, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block', fontFamily: FONT }}>Lead</label>
              <select value={newProj.lead} onChange={e => setNewProj(p => ({ ...p, lead: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', background: '#F5F5F7', fontSize: 14, fontFamily: FONT, outline: 'none' }}>
                <option value="">— Select —</option>
                {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block', fontFamily: FONT }}>Start</label>
              <input type="date" value={newProj.startDate} onChange={e => setNewProj(p => ({ ...p, startDate: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', background: '#F5F5F7', fontSize: 14, fontFamily: FONT, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block', fontFamily: FONT }}>Deadline</label>
              <input type="date" value={newProj.deadline} onChange={e => setNewProj(p => ({ ...p, deadline: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', background: '#F5F5F7', fontSize: 14, fontFamily: FONT, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block', fontFamily: FONT }}>Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setNewProj(p => ({ ...p, color: c }))}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: newProj.color === c ? '3px solid #1D1D1F' : '3px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block', fontFamily: FONT }}>Team Members</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {emps.map(emp => {
                const isLead = newProj.lead === emp.id
                const isMem = isLead || newProj.members.includes(emp.id)
                return (
                  <button key={emp.id} onClick={() => { if (!isLead) toggleMember(emp.id) }}
                    style={{ padding: '5px 12px', borderRadius: 9999, fontSize: 13, fontWeight: isMem ? 590 : 400, background: isMem ? (isLead ? newProj.color + '22' : 'rgba(0,113,227,0.10)') : '#F2F2F7', color: isMem ? (isLead ? newProj.color : '#0071E3') : '#6E6E73', border: `1.5px solid ${isMem ? (isLead ? newProj.color : 'rgba(0,113,227,0.4)') : 'transparent'}`, cursor: isLead ? 'default' : 'pointer', fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {emp.name.split(' ')[0]}{isLead && <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 2, opacity: 0.65 }}>Lead</span>}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addProject} disabled={saving}
              style={{ padding: '8px 18px', background: '#0071E3', color: 'white', border: 'none', borderRadius: 980, fontSize: 13, fontWeight: 590, cursor: 'pointer', fontFamily: FONT }}>
              {saving ? 'Creating…' : 'Create Project'}
            </button>
            <button onClick={() => setShowAdd(false)}
              style={{ padding: '8px 18px', background: 'none', border: '1.5px solid rgba(0,113,227,0.3)', color: '#0071E3', borderRadius: 980, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active project cards */}
      {active.length === 0 && (
        <div style={{ ...CARD, padding: '48px 20px', textAlign: 'center', color: '#AEAEB2', fontFamily: FONT, fontSize: 14 }}>No active projects. Create your first project to get started.</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 12, marginBottom: 16 }}>
        {active.map(p => {
          const tc = todayCount(p.id)
          const tot = totalCount(p.id)
          const last = lastActivity(p.id)
          const lead = emps.find(e => e.id === p.lead)
          const isAct = selected === p.id
          const isOverdue = p.deadline && p.deadline < TODAY
          const daysLeft = p.deadline ? Math.ceil((new Date(p.deadline + 'T12:00:00').getTime() - new Date(TODAY + 'T12:00:00').getTime()) / 86400000) : null
          return (
            <div key={p.id} onClick={() => setSelected(isAct ? null : p.id)}
              style={{ ...CARD, padding: '18px 20px', cursor: 'pointer', borderTop: `3px solid ${p.color}`, boxShadow: isAct ? `0 0 0 2.5px ${p.color}, 0 4px 20px rgba(0,0,0,0.1)` : '0 1px 0 rgba(0,0,0,0.04), 0 2px 16px rgba(0,0,0,0.05)', transition: 'box-shadow .15s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT, color: '#1D1D1F' }}>{p.name}</span>
                <button onClick={e => { e.stopPropagation(); archiveProject(p.id) }}
                  style={{ padding: '2px 8px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 980, fontSize: 11, cursor: 'pointer', color: '#6E6E73', fontFamily: FONT, whiteSpace: 'nowrap' }}>
                  Complete
                </button>
              </div>
              <div style={{ fontSize: 12, color: '#6E6E73', marginBottom: 8, fontFamily: FONT }}>
                Lead: <strong style={{ color: '#1D1D1F' }}>{lead?.name || p.lead || '—'}</strong>
              </div>
              {p.deadline && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: isOverdue ? '#FF3B30' : '#6E6E73', fontWeight: isOverdue ? 700 : 400, fontFamily: FONT }}>
                    {isOverdue ? 'Overdue: ' : 'Due: '}{fmtDate(p.deadline)}
                  </span>
                  {!isOverdue && daysLeft !== null && daysLeft <= 7 && (
                    <span style={{ padding: '1px 7px', borderRadius: 980, fontSize: 10, fontWeight: 700, background: 'rgba(255,149,0,0.12)', color: '#B25900', fontFamily: FONT }}>{daysLeft}d left</span>
                  )}
                  {isOverdue && (
                    <span style={{ padding: '1px 7px', borderRadius: 980, fontSize: 10, fontWeight: 700, background: 'rgba(255,59,48,0.1)', color: '#FF3B30', fontFamily: FONT }}>Overdue</span>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ n: tc, l: 'Today', c: p.color }, { n: tot, l: 'Total', c: '#6E6E73' }, { n: last, l: 'Last', c: '#6E6E73', sm: true }].map(s => (
                  <div key={s.l} style={{ flex: 1, textAlign: 'center', background: '#F5F5F7', borderRadius: 8, padding: '8px 4px' }}>
                    <div style={{ fontWeight: 700, color: s.c, fontSize: s.sm ? 11 : 16, lineHeight: 1.2, fontFamily: FONT }}>{s.n}</div>
                    <div style={{ fontSize: 10, color: '#AEAEB2', marginTop: 2, letterSpacing: '0.02em', textTransform: 'uppercase', fontFamily: FONT }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Project detail panel */}
      {selProj && (
        <div style={{ ...CARD, padding: '20px 24px', marginBottom: 20, borderTop: `3px solid ${selProj.color}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 16, fontFamily: FONT, marginRight: 10 }}>{selProj.name}</span>
              <span style={{ fontSize: 12, color: '#6E6E73', fontFamily: FONT }}>{selEntries.length} submission{selEntries.length !== 1 ? 's' : ''} · {totalHours(selProj.id)}h logged</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {extendPid === selProj.id
                ? <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="date" value={extendDate} onChange={e => setExtendDate(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,113,227,0.3)', background: 'white', fontSize: 13, fontFamily: FONT, outline: 'none' }} />
                  <button onClick={() => extendDeadline(selProj.id)}
                    style={{ padding: '6px 12px', background: '#0071E3', color: 'white', border: 'none', borderRadius: 980, fontSize: 12, cursor: 'pointer', fontFamily: FONT, fontWeight: 590 }}>
                    Extend
                  </button>
                  <button onClick={() => setExtendPid(null)}
                    style={{ padding: '6px 12px', background: 'none', border: '1.5px solid rgba(0,0,0,0.15)', color: '#6E6E73', borderRadius: 980, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
                    Cancel
                  </button>
                </div>
                : selProj.deadline && <button onClick={() => { setExtendPid(selProj.id); setExtendDate(selProj.deadline || '') }}
                  style={{ padding: '6px 12px', background: 'none', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 980, fontSize: 12, cursor: 'pointer', color: '#6E6E73', fontFamily: FONT }}>
                  Extend Deadline
                </button>
              }
            </div>
          </div>

          {/* Deadline info */}
          {selProj.deadline && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ background: '#F5F5F7', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#AEAEB2', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: FONT }}>Deadline</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: selProj.deadline < TODAY ? '#FF3B30' : '#1D1D1F', fontFamily: FONT }}>{fmtDate(selProj.deadline)}</div>
                {(selProj.previous_deadlines || []).length > 0 && (
                  <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 2, fontFamily: FONT }}>Extended from: {selProj.previous_deadlines.map(d => fmtDate(d)).join(', ')}</div>
                )}
              </div>
            </div>
          )}

          {/* Members */}
          {(selProj.members || []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontFamily: FONT }}>Team</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selProj.members.map(mid => {
                  const emp = emps.find(e => e.id === mid)
                  if (!emp) return null
                  const isLead = selProj.lead === mid
                  return (
                    <span key={mid} style={{ padding: '4px 12px', borderRadius: 980, fontSize: 12, fontWeight: isLead ? 600 : 400, background: isLead ? selProj.color + '20' : '#F2F2F7', color: isLead ? selProj.color : '#6E6E73', fontFamily: FONT }}>
                      {emp.name}{isLead ? ' (Lead)' : ''}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Contribution bars */}
          {contribFor(selProj.id).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontFamily: FONT }}>Contributions</div>
              {(() => {
                const contrib = contribFor(selProj.id)
                const maxT = Math.max(...contrib.map(c => c.time), 1)
                return contrib.map(c => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, width: 120, flexShrink: 0, fontFamily: FONT }}>{c.name}</span>
                    <div style={{ flex: 1, height: 6, background: '#F2F2F7', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (c.time / maxT) * 100)}%`, background: selProj.color, borderRadius: 9999 }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#6E6E73', width: 90, textAlign: 'right', flexShrink: 0, fontFamily: FONT }}>{c.entries} entries{c.time > 0 ? ` · ${c.time}h` : ''}</span>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      )}

      {/* Completed projects */}
      {archived.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button onClick={() => setShowCompleted(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontFamily: FONT }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#6E6E73' }}>Completed Projects ({archived.length})</span>
            <span style={{ color: '#AEAEB2', fontSize: 12 }}>{showCompleted ? '▲' : '▼'}</span>
          </button>
          {showCompleted && archived.map(p => {
            const isOpen = expandedArchive === p.id
            const allE = entries.filter(e => (e.project_tasks || []).some(t => t.project_id === p.id))
            const lead = emps.find(e => e.id === p.lead)
            const totT = totalHours(p.id)
            const contrib = contribFor(p.id)
            const maxT = Math.max(...contrib.map(c => c.time), 1)
            const overdue = p.deadline && p.end_date && p.end_date > p.deadline
            const onTime = p.end_date && p.deadline && p.end_date <= p.deadline
            return (
              <div key={p.id} style={{ ...CARD, marginBottom: 10, overflow: 'hidden' }}>
                <div onClick={() => setExpandedArchive(isOpen ? null : p.id)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${p.color}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT }}>{p.name}</span>
                      {overdue && <span style={{ padding: '1px 7px', borderRadius: 980, fontSize: 10, fontWeight: 700, background: 'rgba(255,59,48,0.1)', color: '#FF3B30', fontFamily: FONT }}>Missed Deadline</span>}
                      {onTime && <span style={{ padding: '1px 7px', borderRadius: 980, fontSize: 10, fontWeight: 700, background: 'rgba(52,199,89,0.1)', color: '#34C759', fontFamily: FONT }}>On Time</span>}
                      {!overdue && !onTime && <span style={{ padding: '1px 7px', borderRadius: 980, fontSize: 10, fontWeight: 700, background: '#F2F2F7', color: '#6E6E73', fontFamily: FONT }}>Completed</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6E6E73', fontFamily: FONT }}>
                      Lead: <strong style={{ color: '#1D1D1F' }}>{lead?.name || p.lead}</strong> · {allE.length} entries{totT > 0 ? ` · ${totT}h` : ''}
                    </div>
                  </div>
                  <span style={{ color: '#AEAEB2', fontSize: 11 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16, marginBottom: 16 }}>
                      {p.deadline && (
                        <div style={{ background: '#F5F5F7', borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 120 }}>
                          <div style={{ fontSize: 11, color: '#AEAEB2', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: FONT }}>Deadline</div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: overdue ? '#FF3B30' : '#1D1D1F', fontFamily: FONT }}>{fmtDate(p.deadline)}</div>
                          {(p.previous_deadlines || []).length > 0 && (
                            <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 2, fontFamily: FONT }}>Extended from: {p.previous_deadlines.map(d => fmtDate(d)).join(', ')}</div>
                          )}
                        </div>
                      )}
                      {p.end_date && (
                        <div style={{ background: '#F5F5F7', borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 120 }}>
                          <div style={{ fontSize: 11, color: '#AEAEB2', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: FONT }}>Completed</div>
                          <div style={{ fontWeight: 600, fontSize: 13, fontFamily: FONT }}>{fmtDate(p.end_date)}</div>
                        </div>
                      )}
                      <div style={{ background: '#F5F5F7', borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 100 }}>
                        <div style={{ fontSize: 11, color: '#AEAEB2', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: FONT }}>Hours</div>
                        <div style={{ fontWeight: 600, fontSize: 13, fontFamily: FONT }}>{totT > 0 ? totT + 'h' : '—'}</div>
                      </div>
                    </div>
                    {contrib.map(c => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, width: 120, flexShrink: 0, fontFamily: FONT }}>{c.name}</span>
                        <div style={{ flex: 1, height: 5, background: '#F2F2F7', borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, (c.time / maxT) * 100)}%`, background: p.color, borderRadius: 9999 }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#6E6E73', width: 90, textAlign: 'right', flexShrink: 0, fontFamily: FONT }}>{c.entries} entries{c.time > 0 ? ` · ${c.time}h` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
