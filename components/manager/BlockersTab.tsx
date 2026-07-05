'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Entry, Project } from '@/lib/types'
import { FONT, CARD } from '@/lib/ui'
import { todayIST } from '@/lib/dates'
import { useNudge } from '@/lib/realtime'

function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function dayAge(dateStr: string) {
  const today = todayIST()
  const diff = Math.floor((new Date(today + 'T12:00:00').getTime() - new Date(dateStr + 'T12:00:00').getTime()) / 86400000)
  return diff
}

function ageBorderColor(age: number) {
  if (age >= 2) return '#FF3B30'
  if (age === 1) return '#FF9500'
  return '#AEAEB2'
}

function ageLabel(age: number) {
  if (age === 0) return 'Today'
  if (age === 1) return 'Yesterday'
  return `${age}d ago`
}

export default function BlockersTab() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set())
  const [showResolved, setShowResolved] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const to = todayIST()
      const [ents, projs, res] = await Promise.all([
        fetch(`/api/entries?from=${from}&to=${to}`).then(r => r.json()),
        fetch('/api/projects').then(r => r.json()),
        fetch('/api/resolved-blockers').then(r => r.json()),
      ])
      const all: Entry[] = ents.entries || []
      setEntries(all.filter(e => e.project_tasks?.some(t => t.status === 'blocked' || (t.blockers && t.blockers.trim()))))
      setProjects(projs.projects || [])
      setResolvedKeys(new Set(res.resolved_keys || []))
    } catch (e) { console.error('Failed to load blockers', e) } finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Live updates: an employee logged/edited work (possibly a new blocker) → silently refresh.
  useNudge('employee_changed', () => { load(true) })

  async function toggleResolved(key: string) {
    if (resolvedKeys.has(key)) {
      await fetch(`/api/resolved-blockers?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
      setResolvedKeys(prev => { const s = new Set(prev); s.delete(key); return s })
    } else {
      await fetch('/api/resolved-blockers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
      setResolvedKeys(prev => new Set([...prev, key]))
    }
  }

  const blockerItems = entries.flatMap(entry =>
    entry.project_tasks
      .map((t, i) => ({ entry, task: t, taskIndex: i, key: `${entry.id}:${i}` }))
      .filter(x => x.task.status === 'blocked' || (x.task.blockers && x.task.blockers.trim()))
  )

  const active = blockerItems.filter(b => !resolvedKeys.has(b.key))
  const resolved = blockerItems.filter(b => resolvedKeys.has(b.key))
  const displayed = showResolved ? [...active, ...resolved] : active

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #F2F2F7', borderTopColor: '#33398a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#1D1D1F', fontFamily: FONT, letterSpacing: '-0.02em' }}>Blockers</div>
          <div style={{ fontSize: 13, color: '#6E6E73', marginTop: 2, fontFamily: FONT }}>Last 30 days · {active.length} active</div>
        </div>
        <button onClick={() => setShowResolved(v => !v)}
          style={{ padding: '7px 14px', background: showResolved ? '#F5F5F7' : 'none', border: '1.5px solid rgba(51,57,138,0.3)', borderRadius: 980, fontSize: 13, cursor: 'pointer', color: '#33398a', fontFamily: FONT }}>
          {showResolved ? 'Hide Resolved' : `Show Resolved (${resolved.length})`}
        </button>
      </div>

      {active.length === 0 && !showResolved && (
        <div style={{ ...CARD, padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: '#1D1D1F', fontFamily: FONT, marginBottom: 4 }}>No active blockers</div>
          <div style={{ fontSize: 14, color: '#AEAEB2', fontFamily: FONT }}>All clear for the last 30 days</div>
        </div>
      )}

      {displayed.map(({ entry, task, key }) => {
        const proj = projects.find(p => p.id === task.project_id)
        const isResolved = resolvedKeys.has(key)
        const age = dayAge(entry.date)
        const borderColor = isResolved ? '#34C759' : ageBorderColor(age)

        return (
          <div key={key} style={{ ...CARD, marginBottom: 12, borderLeft: `4px solid ${borderColor}`, opacity: isResolved ? 0.65 : 1 }}>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: isResolved ? '#F2F2F7' : 'rgba(255,59,48,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: isResolved ? '#6E6E73' : '#FF3B30', flexShrink: 0, fontFamily: FONT }}>
                    {entry.employee_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#1D1D1F', fontFamily: FONT }}>{entry.employee_name}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                      <span style={{ fontSize: 12, color: '#6E6E73', fontFamily: FONT }}>{fmtDate(entry.date)}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: borderColor, fontFamily: FONT }}>{ageLabel(age)}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => toggleResolved(key)}
                  style={{ padding: '6px 14px', borderRadius: 980, fontSize: 12, fontWeight: 590, cursor: 'pointer', fontFamily: FONT, flexShrink: 0, border: 'none', background: isResolved ? '#F5F5F7' : '#33398a', color: isResolved ? '#6E6E73' : 'white' }}>
                  {isResolved ? '↩ Reopen' : '✓ Resolve'}
                </button>
              </div>

              <div style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F', fontFamily: FONT, marginBottom: 8, lineHeight: 1.4 }}>{task.task}</div>

              {proj && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 980, fontSize: 11, fontWeight: 600, background: (proj.color || '#AEAEB2') + '20', color: proj.color || '#6E6E73', fontFamily: FONT, marginBottom: 10 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: proj.color || '#AEAEB2', display: 'inline-block' }} />
                  {proj.name}
                </span>
              )}

              <div style={{ padding: '8px 12px', background: 'rgba(255,59,48,0.06)', borderRadius: 8, fontSize: 13, color: '#CC2E26', borderLeft: '3px solid rgba(255,59,48,0.4)', fontFamily: FONT, lineHeight: 1.4 }}>
                {task.blockers}
              </div>

              {isResolved && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#34C759', fontWeight: 600, fontFamily: FONT }}>✓ Resolved</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
