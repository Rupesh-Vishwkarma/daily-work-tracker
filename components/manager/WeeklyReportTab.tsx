'use client'
import { useCallback, useEffect, useState } from 'react'
import { FONT, BRAND, CARD, fmtDate } from '@/lib/ui'
import type { WeeklySummary, EmployeeBrief } from '@/lib/types'

const label: React.CSSProperties = { fontSize: 11, color: '#6E6E73', marginTop: 2 }
const statBox: React.CSSProperties = { flex: 1, padding: '12px 16px', background: '#f6f7fb', borderRadius: 10, textAlign: 'center' }

function StatCard({ value, name }: { value: string; name: string }) {
  return (
    <div style={statBox}>
      <div style={{ fontSize: 20, fontWeight: 700, color: BRAND.navy }}>{value}</div>
      <div style={label}>{name}</div>
    </div>
  )
}

function EmployeeCard({ e, workingDays }: { e: EmployeeBrief; workingDays: number }) {
  const weekly = e.weekly_commitment_outcome === 'completed' ? '✅ weekly goal completed'
    : e.weekly_commitment_outcome === 'carried' ? '↻ weekly goal carried' : 'no weekly goal'
  return (
    <div style={{ ...CARD, padding: '14px 18px', marginTop: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink }}>{e.employee_name}</div>
      <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 2 }}>
        {e.days_submitted}/{workingDays} days{e.absences ? `, ${e.absences} absent` : ''} · {e.tasks_completed} done / {e.tasks_in_progress} in progress / {e.tasks_blocked} blocked · commitments {e.commitments_delivered} delivered, {e.commitments_carried} carried · {weekly}
      </div>
      {e.projects.map((p, i) => (
        <div key={i} style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.purple }}>{p.project_name}</div>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
            {p.tasks.map((t, j) => (
              <li key={j} style={{ fontSize: 12, margin: '3px 0' }}>
                {t.status === 'completed' ? '✅' : t.status === 'blocked' ? '⛔' : '🔄'} {t.title}
                {t.what_changed && <span style={{ color: '#6E6E73' }}> — {t.what_changed}</span>}
              </li>
            ))}
          </ul>
          {p.blockers.length > 0 && (
            <div style={{ fontSize: 12, color: '#b3261e', marginTop: 4 }}>Blocked: {p.blockers.join('; ')}</div>
          )}
        </div>
      ))}
      {e.projects.length === 0 && (
        <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 6 }}>No work logged this week.</div>
      )}
    </div>
  )
}

export default function WeeklyReportTab() {
  const [summaries, setSummaries] = useState<WeeklySummary[]>([])
  const [selected, setSelected] = useState<string>('')
  const [busy, setBusy] = useState<'' | 'generate' | 'send'>('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/weekly-summary')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      const list: WeeklySummary[] = data.summaries || []
      setSummaries(list)
      setSelected(prev => prev && list.some(s => s.week_start === prev) ? prev : (list[0]?.week_start || ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function action(kind: 'generate' | 'send') {
    setBusy(kind)
    setError('')
    try {
      // Target the selected week; with nothing stored yet, omit week_start so
      // the server uses the current week (todayIST).
      const body: { action: string; week_start?: string } = { action: kind }
      if (selected) body.week_start = selected
      const res = await fetch('/api/weekly-summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `${kind} failed`)
      await load()
      if (data.summary?.week_start) setSelected(data.summary.week_start)
    } catch (err) {
      setError(err instanceof Error ? err.message : `${kind} failed`)
    } finally {
      setBusy('')
    }
  }

  const current = summaries.find(s => s.week_start === selected) || null
  const btn: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
    fontFamily: FONT, fontSize: 13, fontWeight: 600,
  }

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selected} onChange={e => setSelected(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 9, borderWidth: 1, borderStyle: 'solid', borderColor: BRAND.border, fontFamily: FONT, fontSize: 13, background: 'white' }}>
          {summaries.length === 0 && <option value="">No summaries yet</option>}
          {summaries.map(s => (
            <option key={s.week_start} value={s.week_start}>
              {fmtDate(s.week_start)} – {fmtDate(s.week_end)}
            </option>
          ))}
        </select>
        <button style={{ ...btn, background: '#eef0f6', color: BRAND.navyDark }}
          disabled={busy !== ''} onClick={() => action('generate')}>
          {busy === 'generate' ? 'Generating…' : 'Generate now'}
        </button>
        <button style={{ ...btn, background: BRAND.navy, color: 'white' }}
          disabled={busy !== ''} onClick={() => action('send')}>
          {busy === 'send' ? 'Sending…' : 'Send Now'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#fdecea', color: '#b3261e', borderRadius: 10, fontSize: 13 }}>{error}</div>
      )}

      {current && (
        <>
          <div style={{ marginTop: 12, fontSize: 12, color: '#6E6E73' }}>
            Generated {new Date(current.generated_at).toLocaleString('en-IN')}
            {current.sent_at
              ? ` · Sent ${new Date(current.sent_at).toLocaleString('en-IN')} to ${(current.sent_to || []).join(', ')}`
              : ' · Not sent yet'}
            {current.send_error && <span style={{ color: '#b3261e' }}> · Last send failed: {current.send_error}</span>}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <StatCard value={`${current.payload.team.submission_rate}%`} name="Submission rate" />
            <StatCard value={String(current.payload.team.commitments_completed)} name="Commitments done" />
            <StatCard value={String(current.payload.team.commitments_carried)} name="Carried" />
            <StatCard value={current.payload.team.on_time_delivery_pct === null ? '—' : `${current.payload.team.on_time_delivery_pct}%`} name="On-time %" />
            <StatCard value={String(current.payload.team.open_blockers)} name="Open blockers" />
          </div>

          {current.payload.attention.length > 0 && (
            <div style={{ marginTop: 12, padding: '14px 18px', background: '#fff8e6', border: `1px solid ${BRAND.gold}`, borderRadius: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.navyDark }}>Needs attention</div>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {current.payload.attention.map((a, i) => (
                  <li key={i} style={{ fontSize: 13, margin: '4px 0', color: '#3a3a3c' }}>
                    <strong>{a.employee_name}</strong>: {a.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {current.payload.employees.map(e => (
            <EmployeeCard key={e.employee_id} e={e} workingDays={current.payload.team.working_days} />
          ))}
        </>
      )}

      {!current && summaries.length === 0 && (
        <div style={{ ...CARD, padding: '24px 18px', marginTop: 12, textAlign: 'center', fontSize: 13, color: '#6E6E73' }}>
          No weekly summaries yet. Click “Generate now” to build one for the current week.
        </div>
      )}
    </div>
  )
}
