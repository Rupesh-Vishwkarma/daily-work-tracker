'use client'
import { useState, useEffect, useCallback } from 'react'
import { Entry, Project } from '@/lib/types'

export default function BlockersTab() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set())
  const [showResolved, setShowResolved] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const to = new Date().toISOString().slice(0, 10)
      const [ents, projs, res] = await Promise.all([
        fetch(`/api/entries?from=${from}&to=${to}`).then(r => r.json()),
        fetch('/api/projects').then(r => r.json()),
        fetch('/api/resolved-blockers').then(r => r.json()),
      ])
      const all: Entry[] = ents.entries || []
      setEntries(all.filter(e => e.project_tasks?.some(t => t.status === 'blocked')))
      setProjects(projs.projects || [])
      setResolvedKeys(new Set(res.resolved_keys || []))
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleResolved(key: string) {
    if (resolvedKeys.has(key)) {
      await fetch(`/api/resolved-blockers?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
      setResolvedKeys(prev => { const s = new Set(prev); s.delete(key); return s })
    } else {
      await fetch('/api/resolved-blockers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
      setResolvedKeys(prev => new Set([...prev, key]))
    }
  }

  // Flatten all blocker tasks with their entry context
  const blockerItems = entries.flatMap(entry =>
    entry.project_tasks
      .map((t, i) => ({ entry, task: t, taskIndex: i, key: `${entry.id}:${i}` }))
      .filter(x => x.task.status === 'blocked')
  )

  const active = blockerItems.filter(b => !resolvedKeys.has(b.key))
  const resolved = blockerItems.filter(b => resolvedKeys.has(b.key))

  if (loading) return <div className="empty-state"><div className="spinner" style={{ width: 28, height: 28, margin: '0 auto' }} /></div>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title">🚫 Blockers</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Last 30 days</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowResolved(v => !v)}>
          {showResolved ? '🔴 Hide Resolved' : `✅ Show Resolved (${resolved.length})`}
        </button>
      </div>

      {active.length === 0 && !showResolved && (
        <div className="empty-state">
          <div className="empty-state-icon">🎉</div>
          <div className="empty-state-text">No active blockers</div>
          <div className="empty-state-sub">All clear for the last 30 days</div>
        </div>
      )}

      {(showResolved ? [...active, ...resolved] : active).map(({ entry, task, key }) => {
        const proj = projects.find(p => p.id === task.project_id)
        const isResolved = resolvedKeys.has(key)
        const date = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        return (
          <div key={key} className="card" style={{ padding: 16, marginBottom: 10, borderLeft: `4px solid ${isResolved ? 'var(--green)' : 'var(--red)'}`, opacity: isResolved ? 0.7 : 1 }}>
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="avatar" style={{ background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13, width: 32, height: 32 }}>
                  {entry.employee_name.charAt(0)}
                </div>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{entry.employee_name}</span>
                  <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 8 }}>{date}</span>
                </div>
              </div>
              <button className={`btn btn-sm ${isResolved ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleResolved(key)}>
                {isResolved ? '↩ Reopen' : '✓ Resolve'}
              </button>
            </div>

            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>{task.task}</div>

            {proj && (
              <span className="project-tag" style={{ background: proj.color + '18', borderColor: proj.color + '40', color: proj.color, marginBottom: 8, display: 'inline-flex' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: proj.color, display: 'inline-block' }} />
                {proj.name}
              </span>
            )}

            <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', fontSize: 13, color: '#CC2E26', borderLeft: '3px solid var(--red)' }}>
              {task.blockers}
            </div>

            {isResolved && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✅ Resolved</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
