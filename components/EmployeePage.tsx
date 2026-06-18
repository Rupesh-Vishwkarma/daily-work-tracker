'use client'
import { useState, useEffect, useCallback } from 'react'
import { Session, Entry } from '@/lib/types'
import EntryCard from './EntryCard'

function getTodayStr() { return new Date().toISOString().slice(0, 10) }

function fmtDate(str: string) {
  return new Date(str + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function EmployeePage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [todayEntry, setTodayEntry] = useState<Entry | null>(null)
  const [loading, setLoading] = useState(true)
  const [work, setWork] = useState('')
  const [blockers, setBlockers] = useState('')
  const [workload, setWorkload] = useState<'light'|'medium'|'heavy'>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchToday = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/entries?today=${getTodayStr()}&employee_id=${session.id}`)
      const data = await res.json()
      setTodayEntry(data.entries?.[0] || null)
    } catch {
      setError('Failed to load data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [session.id])

  useEffect(() => { fetchToday() }, [fetchToday])

  async function handleSubmit() {
    if (!work.trim()) { setError('Please describe your work for today.'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: session.id, employee_name: session.name, date: getTodayStr(), work: work.trim(), blockers: blockers.trim(), workload })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Submission failed.'); return }
      fetchToday()
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteAndResubmit() {
    if (!todayEntry) return
    if (!confirm("Delete today's submission and start a new one?")) return
    await fetch(`/api/entries?id=${todayEntry.id}`, { method: 'DELETE' })
    setTodayEntry(null)
    setWork(''); setBlockers(''); setWorkload('medium')
  }

  const today = getTodayStr()

  return (
    <div>
      <nav style={{ background:'white', borderBottom:'1px solid #E2E8F0', padding:'.875rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.625rem', fontWeight:700, fontSize:'1.0625rem' }}>
          <div style={{ width:28, height:28, background:'#2563EB', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.9rem' }}>📋</div>
          Daily Tracker
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
          <span style={{ fontSize:'.875rem', color:'#64748B', fontWeight:500 }}>{session.name}</span>
          <button onClick={onLogout} style={{ padding:'.375rem .75rem', background:'#F1F5F9', color:'#475569', border:'1px solid #E2E8F0', borderRadius:'.5rem', fontSize:'.8125rem', cursor:'pointer' }}>Logout</button>
        </div>
      </nav>

      <div style={{ padding:'1.5rem', maxWidth:860, margin:'0 auto' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'3rem', color:'#94A3B8' }}>Loading…</div>
        ) : todayEntry ? (
          <>
            <div style={{ background:'linear-gradient(135deg,#D1FAE5,#ECFDF5)', border:'1px solid #A7F3D0', borderRadius:'.75rem', padding:'1.5rem', textAlign:'center', marginBottom:'1.25rem' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>✅</div>
              <h3 style={{ color:'#065F46', fontWeight:700, marginBottom:'.25rem' }}>Today&apos;s update submitted!</h3>
              <p style={{ color:'#047857', fontSize:'.9rem' }}>Submitted for {fmtDate(today)}. Only one entry is allowed per day.</p>
            </div>
            <EntryCard entry={todayEntry} />
            <div style={{ textAlign:'center', marginTop:'1rem' }}>
              <button onClick={handleDeleteAndResubmit} style={{ padding:'.375rem .75rem', background:'#EF4444', color:'white', border:'none', borderRadius:'.5rem', fontSize:'.8125rem', cursor:'pointer', fontWeight:600 }}>
                🗑 Delete &amp; Re-submit
              </button>
              <p style={{ fontSize:'.8rem', color:'#94A3B8', marginTop:'.5rem' }}>This will permanently delete today&apos;s entry so you can submit a new one.</p>
            </div>
          </>
        ) : (
          <div style={{ background:'white', borderRadius:'.75rem', padding:'1.5rem', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight:600, fontSize:'1rem', marginBottom:'1rem', display:'flex', alignItems:'center', gap:'.5rem' }}>
              📝 Today&apos;s Work Update — {fmtDate(today)}
            </div>
            {error && <div style={{ padding:'.875rem 1rem', borderRadius:'.5rem', fontSize:'.9rem', marginBottom:'1rem', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA' }}>{error}</div>}

            <div style={{ marginBottom:'1rem' }}>
              <label>Date</label>
              <input type="date" value={today} readOnly style={{ background:'#F8FAFC', color:'#64748B', cursor:'not-allowed' }} />
            </div>

            <div style={{ marginBottom:'1rem' }}>
              <label>What did you work on today? <span style={{ color:'#EF4444' }}>*</span></label>
              <textarea value={work} onChange={e => setWork(e.target.value)} placeholder="Describe your work, tasks completed, progress made…" rows={5} />
            </div>

            <div style={{ marginBottom:'1rem' }}>
              <label>Blockers / Issues <span style={{ color:'#94A3B8', fontWeight:400 }}>(optional)</span></label>
              <textarea value={blockers} onChange={e => setBlockers(e.target.value)} placeholder="Any issues, dependencies, or blockers slowing you down?" rows={3} />
            </div>

            <div style={{ marginBottom:'1.25rem' }}>
              <label>Workload Level <span style={{ color:'#EF4444' }}>*</span></label>
              <div style={{ display:'flex', gap:'.625rem', marginTop:'.375rem' }}>
                {(['light','medium','heavy'] as const).map(w => (
                  <div key={w} className={`wl-opt ${w}`} style={{ flex:1 }}>
                    <input type="radio" name="workload" id={`wl-${w}`} value={w} checked={workload===w} onChange={() => setWorkload(w)} />
                    <label htmlFor={`wl-${w}`}>{w==='light'?'🟢 Light':w==='medium'?'🟡 Medium':'🔴 Heavy'}</label>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting}
              style={{ width:'100%', padding:'.75rem', background:'#2563EB', color:'white', border:'none', borderRadius:'.5rem', fontSize:'1rem', fontWeight:500, cursor:'pointer', opacity: submitting ? .6 : 1 }}>
              {submitting ? 'Submitting…' : 'Submit Today\'s Update ✓'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
