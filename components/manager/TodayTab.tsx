'use client'
import { useState, useEffect, useCallback } from 'react'
import { Entry, Employee } from '@/lib/types'
import EntryCard from '../EntryCard'

function getTodayStr() { return new Date().toISOString().slice(0, 10) }
function fmtDate(str: string) {
  return new Date(str + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TodayTab() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [eRes, empRes] = await Promise.all([
      fetch(`/api/entries?today=${getTodayStr()}`),
      fetch('/api/employees')
    ])
    const [eData, empData] = await Promise.all([eRes.json(), empRes.json()])
    setEntries(eData.entries || [])
    setEmployees(empData.employees || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: string) {
    await fetch(`/api/entries?id=${id}`, { method: 'DELETE' })
    load()
  }

  const today = getTodayStr()
  const submittedIds = new Set(entries.map(e => e.employee_id))
  const missing = employees.filter(e => !submittedIds.has(e.id))
  const heavy = entries.filter(e => e.workload === 'heavy').length
  const medium = entries.filter(e => e.workload === 'medium').length
  const light = entries.filter(e => e.workload === 'light').length

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', flexWrap:'wrap', gap:'.75rem' }}>
        <div style={{ fontSize:'1.0625rem', fontWeight:600 }}>📅 Today&apos;s Submissions — {fmtDate(today)}</div>
        <button onClick={load} style={{ padding:'.375rem .75rem', background:'#F1F5F9', color:'#475569', border:'1px solid #E2E8F0', borderRadius:'.5rem', fontSize:'.8125rem', cursor:'pointer' }}>↺ Refresh</button>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:'3rem', color:'#94A3B8' }}>Loading…</div> : (<>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
          {[
            { num: entries.length, label: 'Submitted', color: '#2563EB' },
            { num: missing.length, label: 'Pending', color: '#64748B' },
            { num: heavy, label: '🔴 Heavy', color: '#EF4444' },
            { num: medium, label: '🟡 Medium', color: '#F59E0B' },
            { num: light, label: '🟢 Light', color: '#10B981' },
          ].map(s => (
            <div key={s.label} style={{ background:'white', borderRadius:'.75rem', padding:'1.25rem 1rem', boxShadow:'0 1px 4px rgba(0,0,0,.06)', textAlign:'center' }}>
              <div style={{ fontSize:'2rem', fontWeight:700, lineHeight:1, color:s.color }}>{s.num}</div>
              <div style={{ fontSize:'.8125rem', color:'#64748B', marginTop:'.375rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {missing.length > 0 ? (
          <div style={{ background:'white', borderRadius:'.75rem', padding:'1.25rem', boxShadow:'0 1px 4px rgba(0,0,0,.06)', marginBottom:'1.25rem', borderLeft:'4px solid #F59E0B' }}>
            <div style={{ fontWeight:600, color:'#92400E', marginBottom:'1rem' }}>⚠️ Yet to Submit ({missing.length})</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem' }}>
              {missing.map(e => <span key={e.id} className="chip chip-missing">{e.name}</span>)}
            </div>
          </div>
        ) : (
          <div style={{ background:'white', borderRadius:'.75rem', padding:'1.25rem', boxShadow:'0 1px 4px rgba(0,0,0,.06)', marginBottom:'1.25rem', borderLeft:'4px solid #10B981' }}>
            <div style={{ color:'#065F46', fontWeight:600 }}>🎉 All team members have submitted today!</div>
          </div>
        )}

        {entries.length === 0
          ? <div style={{ textAlign:'center', padding:'3rem 1rem', color:'#94A3B8' }}><div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>📭</div><p>No submissions yet for today.</p></div>
          : <div className="scroll-list">{[...entries].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).map(e => <EntryCard key={e.id} entry={e} showName onDelete={handleDelete} />)}</div>
        }
      </>)}
    </div>
  )
}
