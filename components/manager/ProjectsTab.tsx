'use client'
import { useState, useEffect, useCallback } from 'react'
import { Project, Employee } from '@/lib/types'

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#FF2D55', '#5AC8FA', '#FFCC00', '#4CD964', '#FF6B6B']

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
}

function ProjectModal({ project, employees, onClose, onSave }: {
  project: Partial<Project> | null; employees: Employee[]; onClose: () => void; onSave: () => void
}) {
  const isEdit = !!project?.id
  const [name, setName] = useState(project?.name || '')
  const [color, setColor] = useState(project?.color || '#007AFF')
  const [lead, setLead] = useState(project?.lead || '')
  const [members, setMembers] = useState<string[]>(project?.members || [])
  const [deadline, setDeadline] = useState(project?.deadline || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const emps = employees.filter(e => e.role === 'employee')

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError('')
    try {
      const id = isEdit ? project!.id! : slugify(name) || `proj${Date.now()}`
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch('/api/projects', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, color, lead, members, deadline: deadline || null })
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return }
      onSave()
    } catch { setError('Connection error.') } finally { setSaving(false) }
  }

  function toggleMember(id: string) {
    setMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex-between" style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Edit Project' : 'New Project'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text4)' }}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ marginBottom: 14 }}><label>Project Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Merilverse" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label>Color</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '3px solid var(--text)' : '3px solid transparent', transition: 'border .15s' }} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label>Project Lead</label>
          <select value={lead} onChange={e => setLead(e.target.value)}>
            <option value="">No lead</option>
            {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label>Team Members</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {emps.map(e => (
              <button key={e.id} onClick={() => toggleMember(e.id)}
                style={{ padding: '5px 12px', borderRadius: 'var(--r-pill)', border: '1.5px solid', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, transition: 'all .15s',
                  background: members.includes(e.id) ? color + '20' : 'var(--card)',
                  borderColor: members.includes(e.id) ? color : 'var(--border)',
                  color: members.includes(e.id) ? color : 'var(--text3)'
                }}>
                {members.includes(e.id) ? '✓ ' : ''}{e.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>Deadline (optional)</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1, background: color }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsTab() {
  const [projects, setProjects] = useState<Project[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showClosed, setShowClosed] = useState(false)
  const [modal, setModal] = useState<'new' | Partial<Project> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, e] = await Promise.all([fetch('/api/projects').then(r => r.json()), fetch('/api/employees').then(r => r.json())])
      setProjects(p.projects || [])
      setEmployees(e.employees || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function archiveProject(id: string, current: string) {
    if (!confirm(`${current === 'active' ? 'Archive' : 'Reactivate'} this project?`)) return
    await fetch('/api/projects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: current === 'active' ? 'closed' : 'active', end_date: current === 'active' ? new Date().toISOString().slice(0, 10) : null }) })
    load()
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project? This cannot be undone.')) return
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' })
    load()
  }

  const active = projects.filter(p => p.status === 'active')
  const closed = projects.filter(p => p.status === 'closed')
  const displayed = showClosed ? closed : active

  const empMap = Object.fromEntries(employees.map(e => [e.id, e]))

  if (loading) return <div className="empty-state"><div className="spinner" style={{ width: 28, height: 28, margin: '0 auto' }} /></div>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title">📁 Projects</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{active.length} active · {closed.length} closed</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${!showClosed ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowClosed(false)}>Active</button>
          <button className={`btn btn-sm ${showClosed ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowClosed(true)}>Closed</button>
          <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ New</button>
        </div>
      </div>

      {displayed.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">{showClosed ? '📦' : '📁'}</div>
          <div className="empty-state-text">{showClosed ? 'No closed projects' : 'No active projects'}</div>
          {!showClosed && <div className="empty-state-sub">Create your first project to get started</div>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {displayed.map(proj => {
          const leadEmp = proj.lead ? empMap[proj.lead] : null
          const memberEmps = (proj.members || []).map(m => empMap[m]).filter(Boolean)
          const isOverdue = proj.deadline && new Date(proj.deadline) < new Date() && proj.status === 'active'

          return (
            <div key={proj.id} className="card" style={{ borderTop: `4px solid ${proj.color}`, overflow: 'visible' }}>
              <div style={{ padding: 16 }}>
                <div className="flex-between" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: proj.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{proj.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setModal(proj)}>✏️</button>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => archiveProject(proj.id, proj.status)}>
                      {proj.status === 'active' ? '📦' : '↩️'}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--red)' }} onClick={() => deleteProject(proj.id)}>🗑</button>
                  </div>
                </div>

                {leadEmp && (
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6 }}>
                    👤 Lead: <strong style={{ color: 'var(--text)' }}>{leadEmp.name}</strong>
                  </div>
                )}

                {memberEmps.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {memberEmps.slice(0, 5).map(e => (
                      <span key={e!.id} style={{ fontSize: 12, background: proj.color + '15', color: proj.color, padding: '2px 8px', borderRadius: 'var(--r-pill)', fontWeight: 500 }}>{e!.name}</span>
                    ))}
                    {memberEmps.length > 5 && <span style={{ fontSize: 12, color: 'var(--text4)' }}>+{memberEmps.length - 5}</span>}
                  </div>
                )}

                {proj.deadline && (
                  <div style={{ fontSize: 13, color: isOverdue ? 'var(--red)' : 'var(--text3)', fontWeight: isOverdue ? 600 : 400 }}>
                    {isOverdue ? '⚠️ Overdue: ' : '📅 Due: '}
                    {new Date(proj.deadline + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {(modal === 'new' || (modal && typeof modal === 'object')) && (
        <ProjectModal
          project={modal === 'new' ? null : modal as Partial<Project>}
          employees={employees}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
