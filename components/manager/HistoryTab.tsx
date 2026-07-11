'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Entry, Employee, Project, Comment } from '@/lib/types'
import { FONT, CARD, fmtDate } from '@/lib/ui'
import EntryRow from './EntryRow'
import ExportDialog from './ExportDialog'
import { todayIST } from '@/lib/dates'
import { useNudge } from '@/lib/realtime'

const TODAY = todayIST()

function fmtShort(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function parseHours(t: string) {
  return parseFloat((t || '0').replace(/[^\d.]/g, '')) || 0
}

function downloadCSV(entries: Entry[], projects: Project[], filename: string) {
  const rows = [
    ['Date', 'Employee', 'Project', 'Task', 'Status', 'Time', 'Blockers', 'Workload'].join(','),
    ...entries.flatMap(e =>
      (e.project_tasks || []).map(t => {
        const proj = projects.find(p => p.id === t.project_id)
        return [e.date, `"${e.employee_name}"`, `"${proj?.name || t.project_id || ''}"`, `"${(t.task || '').replace(/"/g, '""')}"`, t.status, t.time, `"${(t.blockers || '').replace(/"/g, '""')}"`, e.workload].join(',')
      })
    ),
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${filename}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div style={{ ...CARD, padding: '16px 20px', textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 24, color, fontFamily: FONT, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#AEAEB2', fontFamily: FONT, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

// ── List View ─────────────────────────────────────────────────────────────────
function ListView({ entries, projects, employees }: { entries: Entry[]; projects: Project[]; employees: Employee[] }) {
  const [empFilter, setEmpFilter] = useState('')
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const filtered = empFilter ? entries.filter(e => e.employee_id === empFilter) : entries

  async function onExpand(entryId: string) {
    if (comments[entryId] !== undefined) return
    try {
      const res = await fetch(`/api/comments?entry_id=${entryId}`)
      const d = await res.json()
      setComments(prev => ({ ...prev, [entryId]: d.comments || [] }))
    } catch { setComments(prev => ({ ...prev, [entryId]: [] })) }
  }
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp))
  const grouped: Record<string, Entry[]> = {}
  sorted.forEach(e => { if (!grouped[e.date]) grouped[e.date] = []; grouped[e.date].push(e) })
  const nonMgrEmps = employees.filter(e => e.role === 'employee')

  return (
    <div>
      <div style={{ ...CARD, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={empFilter} onChange={e => setEmpFilter(e.target.value)}
          style={{ flex: 1, minWidth: 160, padding: '8px 12px', fontSize: 13, borderRadius: 8, border: 'none', background: '#F5F5F7', fontFamily: FONT, outline: 'none', color: '#1D1D1F' }}>
          <option value="">All Employees</option>
          {nonMgrEmps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button onClick={() => downloadCSV(filtered, projects, `history-${empFilter || 'all'}`)}
          style={{ padding: '8px 16px', background: '#F5F5F7', color: '#1D1D1F', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 980, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
          ↓ CSV
        </button>
      </div>

      {empFilter && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 16 }}>
          <StatCard value={filtered.length} label="Total Days" color="#1D1D1F" />
          <StatCard value={filtered.filter(e => e.workload === 'heavy').length} label="Heavy Days" color="#FF3B30" />
          <StatCard value={filtered.filter(e => e.workload === 'medium').length} label="Medium Days" color="#FF9500" />
          <StatCard value={filtered.filter(e => e.workload === 'light').length} label="Light Days" color="#34C759" />
        </div>
      )}

      <div style={{ fontSize: 13, color: '#AEAEB2', marginBottom: 12, fontFamily: FONT }}>{filtered.length} entries</div>

      {Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(date => (
        <div key={date}>
          <div style={{ fontWeight: 600, color: '#6E6E73', fontSize: 12, margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: FONT }}>
            <span>{fmtDate(date)}</span>
            <span style={{ color: '#AEAEB2', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{grouped[date].length} submission{grouped[date].length !== 1 ? 's' : ''}</span>
          </div>
          {grouped[date].map(e => <EntryRow key={e.id} entry={e} showName={!empFilter} projects={projects} comments={comments[e.id]} onExpand={onExpand} />)}
        </div>
      ))}
      {sorted.length === 0 && (
        <div style={{ ...CARD, padding: '48px 20px', textAlign: 'center', color: '#AEAEB2', fontFamily: FONT, fontSize: 14 }}>No entries in this date range.</div>
      )}
    </div>
  )
}

// ── Weekly Dashboard ──────────────────────────────────────────────────────────
function WeeklyDashboard({ entries, projects, employees }: { entries: Entry[]; projects: Project[]; employees: Employee[] }) {
  const nonMgrEmps = employees.filter(e => e.role === 'employee')
  const [empId, setEmpId] = useState(nonMgrEmps[0]?.id || '')
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(TODAY + 'T12:00:00')
    const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
    return d.toISOString().slice(0, 10)
  })
  const [selDay, setSelDay] = useState<string | null>(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T12:00:00'); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10)
  })
  const weekEnd = weekDays[6]
  const DAYNAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  function shiftWeek(n: number) {
    const d = new Date(weekStart + 'T12:00:00'); d.setDate(d.getDate() + n * 7); setWeekStart(d.toISOString().slice(0, 10)); setSelDay(null)
  }

  const weekEntries = entries.filter(e => e.employee_id === empId && weekDays.includes(e.date)).sort((a, b) => a.date.localeCompare(b.date))
  const totalH = weekEntries.reduce((s, e) => s + (e.project_tasks || []).reduce((ss, t) => ss + parseHours(t.time), 0), 0)
  const submittedDays = new Set(weekEntries.map(e => e.date)).size
  const allTasks = weekEntries.flatMap(e => (e.project_tasks || []).filter(t => t.status))
  const completionRate = allTasks.length ? Math.round(allTasks.filter(t => t.status === 'completed').length / allTasks.length * 100) : null
  const projH: Record<string, number> = {}
  weekEntries.forEach(e => (e.project_tasks || []).forEach(t => { const h = parseHours(t.time); projH[t.project_id] = (projH[t.project_id] || 0) + h }))
  const projBreak = Object.entries(projH).sort((a, b) => b[1] - a[1])
  const maxProjH = Math.max(...projBreak.map(([, h]) => h), 1)
  const dayH: Record<string, number> = {}
  weekEntries.forEach(e => { const h = (e.project_tasks || []).reduce((s, t) => s + parseHours(t.time), 0); dayH[e.date] = (dayH[e.date] || 0) + h })
  const maxDayH = Math.max(...Object.values(dayH), 1)
  const WL_COLOR: Record<string, string> = { heavy: '#FF3B30', medium: '#FF9500', light: '#34C759' }
  const selDayEntry = selDay ? weekEntries.find(e => e.date === selDay) : null
  const emp = nonMgrEmps.find(e => e.id === empId)

  return (
    <div>
      <div style={{ ...CARD, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select value={empId} onChange={e => { setEmpId(e.target.value); setSelDay(null) }}
          style={{ flex: 1, minWidth: 160, padding: '8px 12px', fontSize: 14, borderRadius: 8, border: 'none', background: '#F5F5F7', fontFamily: FONT, outline: 'none', color: '#1D1D1F' }}>
          {nonMgrEmps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => shiftWeek(-1)} style={{ width: 32, height: 32, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: '#F5F5F7', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', minWidth: 160, textAlign: 'center', fontFamily: FONT }}>{fmtShort(weekStart)} – {fmtShort(weekEnd)}</span>
          <button onClick={() => shiftWeek(1)} style={{ width: 32, height: 32, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: '#F5F5F7', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>›</button>
        </div>
        <button onClick={() => downloadCSV(weekEntries, projects, `${emp?.name || 'report'}-week-${weekStart}`)}
          style={{ padding: '8px 14px', background: '#F5F5F7', color: '#1D1D1F', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>↓ CSV</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 16 }}>
        <StatCard value={submittedDays} label="Days Submitted" color="#1D1D1F" />
        <StatCard value={totalH > 0 ? totalH + 'h' : '—'} label="Hours Logged" color="#6366F1" />
        <StatCard value={completionRate !== null ? completionRate + '%' : '—'} label="Tasks Done" color="#34C759" />
        <StatCard value={projBreak.length || '—'} label="Projects" color="#33398a" />
      </div>

      {weekEntries.length === 0
        ? <div style={{ ...CARD, padding: '48px 20px', textAlign: 'center', color: '#AEAEB2', fontFamily: FONT, fontSize: 14 }}>No submissions this week.</div>
        : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ ...CARD, padding: '20px 24px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, fontFamily: FONT }}>Day by Day</div>
            {weekDays.map((date, i) => {
              const dayEntry = weekEntries.find(e => e.date === date)
              const h = dayH[date] || 0
              const isSelected = selDay === date
              const color = dayEntry ? WL_COLOR[dayEntry.workload] || '#33398a' : '#E5E5EA'
              return (
                <div key={date} onClick={() => { if (dayEntry) setSelDay(isSelected ? null : date) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: dayEntry ? 'pointer' : 'default', opacity: i >= 6 && !dayEntry ? 0.35 : 1 }}>
                  <div style={{ width: 32, fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#33398a' : '#6E6E73', flexShrink: 0, fontFamily: FONT }}>{DAYNAMES[i]}</div>
                  <div style={{ flex: 1, height: 8, background: '#F2F2F7', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: dayEntry ? `${Math.max(4, (h / maxDayH) * 100)}%` : '0%', background: isSelected ? '#33398a' : color, borderRadius: 9999, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ width: 30, textAlign: 'right', fontSize: 12, color: h > 0 ? '#1D1D1F' : '#AEAEB2', fontWeight: h > 0 ? 600 : 400, flexShrink: 0, fontFamily: FONT }}>{h > 0 ? h + 'h' : '—'}</div>
                </div>
              )
            })}
          </div>
          <div style={{ ...CARD, padding: '20px 24px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, fontFamily: FONT }}>Project Time</div>
            {projBreak.length === 0
              ? <div style={{ color: '#AEAEB2', fontSize: 13, textAlign: 'center', paddingTop: 20, fontFamily: FONT }}>No hours logged.</div>
              : projBreak.map(([pid, hrs]) => {
                const proj = projects.find(p => p.id === pid)
                const color = proj?.color || '#AEAEB2'
                const name = pid === '__other__' ? 'Other Work' : (proj?.name || pid)
                return (
                  <div key={pid} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5, fontFamily: FONT }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
                        <span style={{ fontWeight: 500 }}>{name}</span>
                      </span>
                      <span style={{ color: '#6E6E73', fontWeight: 600 }}>{hrs > 0 ? hrs + 'h' : '—'}</span>
                    </div>
                    <div style={{ height: 5, background: '#F2F2F7', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(hrs / maxProjH) * 100}%`, background: color, borderRadius: 9999 }} />
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
      }

      {selDay && selDayEntry && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E73', marginBottom: 12, fontFamily: FONT }}>
            {new Date(selDay + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>
          <EntryRow entry={selDayEntry} showName={false} projects={projects} comments={undefined} onExpand={undefined} />
        </div>
      )}
    </div>
  )
}

// ── People Dashboard ──────────────────────────────────────────────────────────
function PeopleDashboard({ entries, projects, employees }: { entries: Entry[]; projects: Project[]; employees: Employee[] }) {
  const nonMgrEmps = employees.filter(e => e.role === 'employee')
  const [empId, setEmpId] = useState(nonMgrEmps[0]?.id || '')
  const [period, setPeriod] = useState('month')

  const pStart = (() => {
    const d = new Date(TODAY + 'T12:00:00')
    if (period === 'week') { const dow = d.getDay(); d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)) }
    else if (period === 'month') { d.setDate(1) }
    else if (period === '3m') { d.setMonth(d.getMonth() - 3) }
    else return '2020-01-01'
    return d.toISOString().slice(0, 10)
  })()

  const myE = entries.filter(e => e.employee_id === empId && !e.is_absent && e.date >= pStart && e.date <= TODAY)
  const absentE = entries.filter(e => e.employee_id === empId && e.is_absent && e.date >= pStart && e.date <= TODAY)

  function workingDays(s: string, end: string) {
    let c = 0; const d = new Date(s + 'T12:00:00'); const e = new Date(end + 'T12:00:00')
    // Working week is Mon–Sat; only Sunday (day 0) is a non-working day.
    while (d <= e) { if (d.getDay() !== 0) c++; d.setDate(d.getDate() + 1) }
    return c
  }

  const wDays = workingDays(pStart, TODAY)
  const submDays = new Set(myE.map(e => e.date)).size
  const absDays = new Set(absentE.map(e => e.date)).size
  const submRate = wDays > 0 ? Math.round(submDays / wDays * 100) : 0
  const totalH = myE.reduce((s, e) => s + (e.project_tasks || []).reduce((ss, t) => ss + parseHours(t.time), 0), 0)
  const allTasks = myE.flatMap(e => (e.project_tasks || []).filter(t => t.status))
  const doneTasks = allTasks.filter(t => t.status === 'completed').length
  const completionRate = allTasks.length ? Math.round(doneTasks / allTasks.length * 100) : null
  const wlC = { heavy: myE.filter(e => e.workload === 'heavy').length, medium: myE.filter(e => e.workload === 'medium').length, light: myE.filter(e => e.workload === 'light').length }
  const projH: Record<string, number> = {}
  const projDone: Record<string, number> = {}
  const projTotal: Record<string, number> = {}
  myE.forEach(e => (e.project_tasks || []).forEach(t => {
    const h = parseHours(t.time); projH[t.project_id] = (projH[t.project_id] || 0) + h
    if (t.status) { projTotal[t.project_id] = (projTotal[t.project_id] || 0) + 1; if (t.status === 'completed') projDone[t.project_id] = (projDone[t.project_id] || 0) + 1 }
  }))
  const projBreak = Object.entries(projH).sort((a, b) => b[1] - a[1])
  const PERIODS = [['week', 'This Week'], ['month', 'This Month'], ['3m', '3 Months'], ['all', 'All Time']]
  const rateColor = submRate >= 80 ? '#34C759' : submRate >= 60 ? '#FF9500' : '#FF3B30'
  const SEC: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 20, fontFamily: FONT }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={empId} onChange={e => setEmpId(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '9px 12px', fontSize: 14, borderRadius: 8, border: 'none', background: '#F2F2F7', fontFamily: FONT, outline: 'none', color: '#1D1D1F', fontWeight: 600 }}>
          {nonMgrEmps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 3, background: '#F2F2F7', borderRadius: 10, padding: 3 }}>
          {PERIODS.map(([id, label]) => (
            <button key={id} onClick={() => setPeriod(id)}
              style={{ padding: '7px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: period === id ? 'white' : 'transparent', color: period === id ? '#1D1D1F' : '#6E6E73', fontWeight: period === id ? 600 : 400, fontSize: 13, fontFamily: FONT, boxShadow: period === id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {myE.length === 0 && absDays === 0
        ? <div style={{ ...CARD, padding: '48px 20px', textAlign: 'center', color: '#AEAEB2', fontFamily: FONT, fontSize: 14 }}>No submissions in this period.</div>
        : <>
          <div style={SEC}>Reliability</div>
          <div style={{ ...CARD, padding: '18px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: FONT }}>
                  {submDays}<span style={{ fontSize: 16, color: '#AEAEB2', fontWeight: 400 }}>/{wDays}</span>
                </div>
                <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 4, fontFamily: FONT }}>
                  days submitted <span style={{ marginLeft: 6, fontWeight: 600, color: rateColor }}>{submRate}%</span>
                </div>
              </div>
              {absDays > 0 && (
                <div style={{ padding: '8px 14px', background: 'rgba(255,149,0,0.08)', borderRadius: 10, border: '1px solid rgba(255,149,0,0.2)' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#B25900', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: FONT }}>{absDays}</div>
                  <div style={{ fontSize: 12, color: '#B25900', marginTop: 3, fontFamily: FONT }}>absent day{absDays !== 1 ? 's' : ''}</div>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ height: 8, background: '#F2F2F7', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: submRate + '%', background: rateColor, borderRadius: 9999, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#AEAEB2', marginTop: 4, fontFamily: FONT }}>
                  <span>{fmtShort(pStart)}</span><span>{fmtShort(TODAY)}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={SEC}>Output</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ ...CARD, padding: '18px 20px' }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#6366F1', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: FONT }}>{totalH > 0 ? totalH + 'h' : '—'}</div>
                  <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 4, fontFamily: FONT }}>hours logged</div>
                </div>
                {completionRate !== null && (
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: FONT }}>{completionRate}%</div>
                    <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 4, fontFamily: FONT }}>tasks completed</div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ ...CARD, padding: '18px 20px' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, fontFamily: FONT }}>Workload Mix</div>
              {[{ l: 'Heavy', c: '#FF3B30', n: wlC.heavy }, { l: 'Medium', c: '#FF9500', n: wlC.medium }, { l: 'Light', c: '#34C759', n: wlC.light }].map(row => {
                const pct = submDays ? Math.round(row.n / submDays * 100) : 0
                return (
                  <div key={row.l} style={{ marginBottom: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, fontFamily: FONT }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: row.c, display: 'inline-block' }} />{row.l}
                      </span>
                      <span style={{ fontWeight: 600, color: row.c }}>{row.n} <span style={{ color: '#AEAEB2', fontWeight: 400 }}>({pct}%)</span></span>
                    </div>
                    <div style={{ height: 5, background: '#F2F2F7', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: row.c, borderRadius: 9999 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {projBreak.length > 0 && (
            <>
              <div style={SEC}>Projects</div>
              <div style={{ ...CARD, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: FONT }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      {['Project', 'Hours', 'Done'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projBreak.map(([pid, hrs]) => {
                      const proj = projects.find(p => p.id === pid)
                      const color = proj?.color || '#AEAEB2'
                      const name = pid === '__other__' ? 'Other Work' : (proj?.name || pid)
                      const total = projTotal[pid] || 0
                      const done = projDone[pid] || 0
                      const doneRate = total ? Math.round(done / total * 100) : null
                      return (
                        <tr key={pid} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                              <span style={{ fontWeight: 500 }}>{name}</span>
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1D1D1F' }}>{hrs > 0 ? hrs + 'h' : '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {doneRate !== null
                              ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 48, height: 4, background: '#F2F2F7', borderRadius: 9999, overflow: 'hidden', flexShrink: 0 }}>
                                  <div style={{ height: '100%', width: doneRate + '%', background: color, borderRadius: 9999 }} />
                                </div>
                                <span style={{ fontSize: 12, color: '#6E6E73' }}>{done}/{total}</span>
                              </div>
                              : '—'
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      }
    </div>
  )
}

// ── Calendar View ─────────────────────────────────────────────────────────────
function CalendarView({ entries, projects, employees }: { entries: Entry[]; projects: Project[]; employees: Employee[] }) {
  const now = new Date(TODAY + 'T12:00:00')
  const [vY, setVY] = useState(now.getFullYear())
  const [vM, setVM] = useState(now.getMonth())
  const [sel, setSel] = useState(TODAY)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})

  async function onExpand(entryId: string) {
    if (comments[entryId] !== undefined) return
    try {
      const res = await fetch(`/api/comments?entry_id=${entryId}`)
      const d = await res.json()
      setComments(prev => ({ ...prev, [entryId]: d.comments || [] }))
    } catch { setComments(prev => ({ ...prev, [entryId]: [] })) }
  }
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  function prevM() { if (vM === 0) { setVM(11); setVY(y => y - 1) } else setVM(m => m - 1) }
  function nextM() { if (vM === 11) { setVM(0); setVY(y => y + 1) } else setVM(m => m + 1) }

  const fd = new Date(vY, vM, 1).getDay()
  const dim = new Date(vY, vM + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < fd; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function ds(d: number) { return `${vY}-${String(vM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` }

  const entryByDate: Record<string, Entry[]> = {}
  entries.forEach(e => { if (!entryByDate[e.date]) entryByDate[e.date] = []; entryByDate[e.date].push(e) })

  function dots(d: number) {
    if (!d) return []
    const de = entryByDate[ds(d)] || []
    const r: string[] = []
    if (de.some(e => e.workload === 'heavy')) r.push('#FF3B30')
    if (de.some(e => e.workload === 'medium')) r.push('#FF9500')
    if (de.some(e => e.workload === 'light')) r.push('#34C759')
    return r
  }

  const selEntries = (entryByDate[sel] || []).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const selDateStr = sel ? new Date(sel + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ''
  const nonMgrEmps = employees.filter(e => e.role === 'employee')
  const submittedIds = new Set(selEntries.map(e => e.employee_id))
  const missingEmps = nonMgrEmps.filter(e => !submittedIds.has(e.id))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ ...CARD, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={prevM} style={{ width: 32, height: 32, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: '#F5F5F7', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>‹</button>
          <span style={{ fontWeight: 700, fontSize: 15, fontFamily: FONT }}>{MONTHS[vM]} {vY}</span>
          <button onClick={nextM} style={{ width: 32, height: 32, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: '#F5F5F7', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
          {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#AEAEB2', padding: '4px 0', fontFamily: FONT }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={'b' + i} />
            const dStr = ds(d)
            const isToday = dStr === TODAY
            const isSel = dStr === sel
            const dt = dots(d)
            const hasE = dt.length > 0
            return (
              <div key={dStr} onClick={() => setSel(dStr)}
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 2px', borderRadius: 8, background: isSel ? '#33398a' : isToday ? 'rgba(51,57,138,0.08)' : hasE ? '#F5F5F7' : 'transparent', border: isToday && !isSel ? '1.5px solid #33398a' : '1.5px solid transparent', transition: 'background .12s' }}>
                <span style={{ fontSize: 12, fontWeight: isToday || isSel ? 700 : 400, color: isSel ? 'white' : isToday ? '#33398a' : '#1D1D1F', lineHeight: 1, fontFamily: FONT }}>{d}</span>
                <div style={{ display: 'flex', gap: 2, marginTop: 3, height: 5 }}>
                  {dt.map((c, j) => <div key={j} style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.7)' : c }} />)}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)', justifyContent: 'center' }}>
          {[['#FF3B30', 'Heavy'], ['#FF9500', 'Medium'], ['#34C759', 'Light']].map(([c, l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6E6E73', fontFamily: FONT }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div style={{ ...CARD, padding: '16px 20px', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', fontFamily: FONT }}>{selDateStr}</div>
          <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 2, fontFamily: FONT }}>
            {selEntries.length === 0 ? 'No submissions' : `${selEntries.length} submission${selEntries.length > 1 ? 's' : ''}`}
            {missingEmps.length > 0 && <span style={{ color: '#FF9500', fontWeight: 500 }}> · {missingEmps.length} not submitted</span>}
            {missingEmps.length === 0 && selEntries.length > 0 && <span style={{ color: '#34C759', fontWeight: 600 }}> · All submitted</span>}
          </div>
        </div>
        {selEntries.length === 0
          ? <div style={{ ...CARD, padding: '48px 20px', textAlign: 'center', color: '#AEAEB2', fontFamily: FONT, fontSize: 14 }}>No submissions for this date.</div>
          : selEntries.map(e => <EntryRow key={e.id} entry={e} showName projects={projects} comments={comments[e.id]} onExpand={onExpand} />)
        }
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
type View = 'list' | 'weekly' | 'people' | 'calendar'

export default function HistoryTab() {
  const [view, setView] = useState<View>('calendar')
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(TODAY)
  const [entries, setEntries] = useState<Entry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showExport, setShowExport] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [ents, emps, projs] = await Promise.all([
        fetch(`/api/entries?from=${from}&to=${to}`).then(r => r.json()),
        fetch('/api/employees').then(r => r.json()),
        fetch('/api/projects').then(r => r.json()),
      ])
      setEntries(ents.entries || [])
      setEmployees(emps.employees || [])
      setProjects(projs.projects || [])
    } finally { if (!silent) setLoading(false) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  // Live updates: an employee logged or edited work → silently refresh the history.
  useNudge('employee_changed', () => { load(true) })

  function setRange(days: number) {
    setTo(TODAY)
    setFrom(new Date(Date.now() - days * 86400000).toISOString().slice(0, 10))
  }

  const VIEWS: { id: View; label: string }[] = [
    { id: 'calendar', label: 'Calendar' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'people', label: 'People' },
    { id: 'list', label: 'List' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 22, color: '#1D1D1F', fontFamily: FONT, letterSpacing: '-0.02em' }}>History</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 3, background: '#F2F2F7', borderRadius: 10, padding: 3 }}>
            {VIEWS.map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', background: view === v.id ? 'white' : 'transparent', color: view === v.id ? '#1D1D1F' : '#6E6E73', fontWeight: view === v.id ? 600 : 400, fontSize: 13, fontFamily: FONT, boxShadow: view === v.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowExport(true)}
            style={{ padding: '7px 16px', borderRadius: 980, border: 'none', cursor: 'pointer', background: '#33398a', color: 'white', fontWeight: 600, fontSize: 13, fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ↓ Export
          </button>
        </div>
      </div>

      {showExport && <ExportDialog employees={employees} projects={projects} onClose={() => setShowExport(false)} />}

      {/* Date range (for list view) */}
      {view === 'list' && (
        <div style={{ background: 'white', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 2px 16px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 220 }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none', background: '#F5F5F7', fontSize: 13, fontFamily: FONT, outline: 'none' }} />
            <span style={{ color: '#AEAEB2', fontSize: 13, fontFamily: FONT }}>to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none', background: '#F5F5F7', fontSize: 13, fontFamily: FONT, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }].map(p => (
              <button key={p.label} onClick={() => setRange(p.days)}
                style={{ padding: '6px 12px', background: '#F5F5F7', color: '#6E6E73', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading
        ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 28, height: 28, border: '3px solid #F2F2F7', borderTopColor: '#33398a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
        : <>
          {view === 'list' && <ListView entries={entries} projects={projects} employees={employees} />}
          {view === 'weekly' && <WeeklyDashboard entries={entries} projects={projects} employees={employees} />}
          {view === 'people' && <PeopleDashboard entries={entries} projects={projects} employees={employees} />}
          {view === 'calendar' && <CalendarView entries={entries} projects={projects} employees={employees} />}
        </>
      }
    </div>
  )
}
