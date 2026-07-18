'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Commitment, Employee, Project } from '@/lib/types'
import { FONT, CARD, fmtDate } from '@/lib/ui'
import { todayIST } from '@/lib/dates'
import { useNudge } from '@/lib/realtime'

// 'open' commitments are in progress (possibly carried); 'done' is completed.
// 'partial'/'missed' remain only so any pre-existing rows still render.
const OUTCOME: Record<string, { label: string; color: string }> = {
  open:    { label: 'In progress', color: '#33398a' },
  done:    { label: 'Completed',   color: '#34C759' },
  partial: { label: 'Partial',     color: '#FF9500' },
  missed:  { label: 'Missed',      color: '#FF3B30' },
}

const PERIODS = [
  { id: 7, label: '7 days' },
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
]

interface MemberStats {
  employee: Employee
  promised: number
  delivered: number
  open: number
  reliability: number | null
  stalled: Commitment[]
}

export default function CommitmentsTab() {
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
      const [cRes, eRes, pRes] = await Promise.all([
        fetch(`/api/commitments?from=${from}`).then(r => r.json()),
        fetch('/api/employees').then(r => r.json()),
        fetch('/api/projects').then(r => r.json()),
      ])
      setCommitments(cRes.commitments || [])
      setEmployees((eRes.employees || []).filter((e: Employee) => e.role === 'employee'))
      setProjects(pRes.projects || [])
    } catch { } finally { if (!silent) setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  // Live updates: an employee logged work or resolved a commitment → silently refresh.
  useNudge('employee_changed', () => { load(true) })

  const today = todayIST()

  // On-time delivery = completed without ever carrying forward. Open (carried)
  // commitments are still in flight and excluded until completed.
  const memberStats: MemberStats[] = employees.map(emp => {
    const mine = commitments.filter(c => c.employee_id === emp.id)
    const completed = mine.filter(c => c.status === 'done')
    const onTime = completed.filter(c => (c.carry_count || 0) === 0).length
    return {
      employee: emp,
      promised: mine.length,
      delivered: completed.length,
      open: mine.filter(c => c.status === 'open').length,
      reliability: completed.length ? Math.round(onTime / completed.length * 100) : null,
      stalled: mine.filter(c => c.status === 'open' && c.carry_count >= 3),
    }
  }).sort((a, b) => (a.reliability ?? 101) - (b.reliability ?? 101))

  const allStalled = memberStats.flatMap(m => m.stalled)
  const completedAll = commitments.filter(c => c.status === 'done')
  const teamReliability = completedAll.length
    ? Math.round(completedAll.filter(c => (c.carry_count || 0) === 0).length / completedAll.length * 100)
    : null
  const openOverdue = commitments.filter(c => c.status === 'open' && c.due_date <= today).length

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #F2F2F7', borderTopColor: '#33398a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#6E6E73', fontFamily: FONT, marginRight: 4 }}>Period:</span>
        {PERIODS.map(p => (
          <button key={p.id} onClick={() => setDays(p.id)}
            style={{ padding: '5px 14px', borderRadius: 980, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, border: 'none', background: days === p.id ? '#33398a' : '#F2F2F7', color: days === p.id ? 'white' : '#6E6E73' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Team stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { v: teamReliability !== null ? teamReliability + '%' : '—', l: 'On-time Delivery', c: '#4b3e9d' },
          { v: commitments.length, l: 'Commitments Made', c: '#33398a' },
          { v: completedAll.length, l: 'Completed', c: '#34C759' },
          { v: openOverdue, l: 'Due / Overdue', c: '#FF9500' },
          { v: allStalled.length, l: 'Stalled (3+ carries)', c: '#FF3B30' },
        ].map(s => (
          <div key={s.l} style={{ ...CARD, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 22, color: s.c, fontFamily: FONT, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: '#AEAEB2', fontFamily: FONT, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Stalled escalation */}
      {allStalled.length > 0 && (
        <div style={{ ...CARD, padding: '16px 20px', marginBottom: 16, borderLeft: '3px solid #FF3B30' }}>
          <div style={{ fontWeight: 600, color: '#CC0000', marginBottom: 10, fontSize: 14, fontFamily: FONT }}>
            Stalled work — committed {'\u2265'}3 times without delivery
          </div>
          {allStalled.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#1D1D1F', fontFamily: FONT }}>{c.employee_name}</span>
              <span style={{ fontSize: 13, color: '#3C3C43', fontFamily: FONT, flex: 1, minWidth: 160 }}>{c.text}</span>
              <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 700, background: 'rgba(255,59,48,0.1)', color: '#FF3B30', fontFamily: FONT }}>⟳ ×{c.carry_count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Per-member promise vs delivered */}
      {memberStats.map(m => {
        const isOpen = expanded === m.employee.id
        const mine = commitments.filter(c => c.employee_id === m.employee.id)
        return (
          <div key={m.employee.id} style={{ ...CARD, marginBottom: 12, overflow: 'hidden' }}>
            <div onClick={() => setExpanded(isOpen ? null : m.employee.id)}
              style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flexWrap: 'wrap' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#3C3C43', flexShrink: 0, fontFamily: FONT }}>
                {m.employee.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#1D1D1F', fontFamily: FONT }}>{m.employee.name}</div>
                <div style={{ fontSize: 12, color: '#AEAEB2', fontFamily: FONT }}>
                  {m.promised} committed · {m.delivered} completed · {m.open} in progress
                </div>
              </div>
              {m.stalled.length > 0 && (
                <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 700, background: 'rgba(255,59,48,0.1)', color: '#FF3B30', fontFamily: FONT }}>
                  {m.stalled.length} stalled
                </span>
              )}
              <div style={{ textAlign: 'right', minWidth: 90 }}>
                <div style={{ fontWeight: 700, fontSize: 20, fontFamily: FONT, letterSpacing: '-0.02em', color: m.reliability === null ? '#AEAEB2' : m.reliability >= 75 ? '#34C759' : m.reliability >= 50 ? '#FF9500' : '#FF3B30' }}>
                  {m.reliability !== null ? m.reliability + '%' : '—'}
                </div>
                <div style={{ fontSize: 10, color: '#AEAEB2', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>On-time</div>
              </div>
              <span style={{ color: '#AEAEB2', fontSize: 14 }}>{isOpen ? '▾' : '▸'}</span>
            </div>

            {isOpen && (
              <div style={{ padding: '0 20px 16px' }}>
                {mine.length === 0 && (
                  <div style={{ fontSize: 13, color: '#AEAEB2', fontFamily: FONT, fontStyle: 'italic', padding: '8px 0' }}>No commitments in this period.</div>
                )}
                {mine.map(c => {
                  const proj = projects.find(p => p.id === c.project_id)
                  const o = OUTCOME[c.status]
                  const overdue = c.status === 'open' && c.due_date <= today
                  return (
                    <div key={c.id} style={{ background: '#F5F5F7', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 700, background: o.color + '15', color: o.color, fontFamily: FONT }}>{o.label}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 10, fontWeight: 700, background: c.horizon === 'week' ? 'rgba(75,62,157,0.12)' : 'rgba(0,0,0,0.05)', color: c.horizon === 'week' ? '#4b3e9d' : '#6E6E73', fontFamily: FONT }}>
                          {c.horizon === 'week' ? 'WEEK' : 'DAY'}
                        </span>
                        {proj && (
                          <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 600, background: proj.color + '18', color: proj.color, fontFamily: FONT }}>{proj.name}</span>
                        )}
                        {c.project_id === '__other__' && (
                          <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,0.06)', color: '#6E6E73', fontFamily: FONT }}>Other Work</span>
                        )}
                        {c.carry_count > 0 && (
                          <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 700, background: 'rgba(255,149,0,0.12)', color: '#B25900', fontFamily: FONT }}>⟳ ×{c.carry_count}</span>
                        )}
                        <span style={{ fontSize: 11, color: overdue ? '#FF3B30' : '#AEAEB2', fontFamily: FONT, marginLeft: 'auto', fontWeight: overdue ? 700 : 400 }}>
                          due {fmtDate(c.due_date)}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#1D1D1F', lineHeight: 1.5, fontFamily: FONT }}>{c.text}</div>
                      {c.outcome_note && (
                        <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 4, fontFamily: FONT, fontStyle: 'italic' }}>“{c.outcome_note}”</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {employees.length === 0 && (
        <div style={{ ...CARD, padding: '48px 20px', textAlign: 'center', color: '#AEAEB2', fontFamily: FONT, fontSize: 14 }}>
          No team members yet.
        </div>
      )}
    </div>
  )
}
