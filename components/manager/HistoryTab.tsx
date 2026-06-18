'use client'
import { useState, useEffect, useCallback } from 'react'
import { Entry, Employee } from '@/lib/types'
import EntryCard from '../EntryCard'

function getTodayStr() { return new Date().toISOString().slice(0, 10) }
function fmtDate(str: string) {
  return new Date(str + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}

export default function HistoryTab() {
  const today = getTodayStr()
  const [from, setFrom] = useState(daysAgo(7))
  const [to, setTo] = useState(today)
  const [empFilter, setEmpFilter] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  // Add entry form
  const [aeEmp, setAeEmp] = useState('')
  const [aeDate, setAeDate] = useState(today)
  const [aeWork, setAeWork] = useState('')
  const [aeBlockers, setAeBlockers] = useState('')
  const [aeWorkload, setAeWorkload] = useState<'light'|'medium'|'heavy'>('medium')
  const [aeMsg, setAeMsg] = useState<{type:string;text:string}|null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => { fetch('/api/employees').then(r=>r.json()).then(d=>setEmployees(d.employees||[])) }, [])

  const applyFilter = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ from, to })
    if (empFilter) params.set('employee_id', empFilter)
    const res = await fetch(`/api/entries?${params}`)
    const data = await res.json()
    setEntries(data.entries || [])
    setLoading(false)
  }, [from, to, empFilter])

  useEffect(() => { applyFilter() }, [applyFilter])

  async function handleDelete(id: string) {
    await fetch(`/api/entries?id=${id}`, { method: 'DELETE' })
    applyFilter()
  }

  async function handleAddEntry() {
    if (!aeEmp || !aeDate || !aeWork.trim()) { setAeMsg({type:'error',text:'Please fill all required fields.'}); return }
    setAdding(true)
    const emp = employees.find(e => e.id === aeEmp)
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: aeEmp, employee_name: emp?.name || '', date: aeDate, work: aeWork.trim(), blockers: aeBlockers.trim(), workload: aeWorkload })
    })
    const data = await res.json()
    setAdding(false)
    if (!res.ok) { setAeMsg({type:'error',text:data.error||'Failed to add entry.'}); return }
    setAeMsg({type:'success',text:`Entry added for ${emp?.name} on ${fmtDate(aeDate)}.`})
    setAeWork(''); setAeBlockers(''); setAeEmp('')
    applyFilter()
  }

  function exportCSV() {
    const rows = [['Employee','Date','Work Done','Blockers','Workload','Submitted At']]
    entries.forEach(e => rows.push([e.employee_name, e.date, e.work.replace(/\n/g,' '), (e.blockers||'').replace(/\n/g,' '), e.workload, e.timestamp]))
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`work_tracker_${today}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const grouped: Record<string, Entry[]> = {}
  entries.forEach(e => { if (!grouped[e.date]) grouped[e.date]=[]; grouped[e.date].push(e) })

  const alertStyle = (type: string) => ({
    padding:'.875rem 1rem', borderRadius:'.5rem', fontSize:'.9rem', marginBottom:'1rem',
    background: type==='success'?'#D1FAE5':'#FEE2E2',
    color: type==='success'?'#065F46':'#991B1B',
    border: `1px solid ${type==='success'?'#A7F3D0':'#FECACA'}`
  })

  return (
    <div>
      <div style={{ fontSize:'1.0625rem', fontWeight:600, marginBottom:'1rem' }}>📋 Work History</div>

      {/* Add entry panel */}
      <div style={{ background:'white', borderRadius:'.75rem', padding:'1.25rem', boxShadow:'0 1px 4px rgba(0,0,0,.06)', marginBottom:'1.25rem' }}>
        <div onClick={() => setAddOpen(!addOpen)} style={{ fontWeight:600, cursor:'pointer', userSelect:'none', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>➕ Add Entry for Any Date</span>
          <span style={{ fontSize:'.8rem', color:'#64748B', fontWeight:400 }}>{addOpen ? '▲ collapse' : '▼ expand'}</span>
        </div>
        {addOpen && (
          <div style={{ marginTop:'1rem' }}>
            {aeMsg && <div style={alertStyle(aeMsg.type)}>{aeMsg.text}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem' }}>
              <div><label>Employee <span style={{color:'#EF4444'}}>*</span></label>
                <select value={aeEmp} onChange={e=>setAeEmp(e.target.value)}>
                  <option value="">— Select —</option>
                  {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div><label>Date <span style={{color:'#EF4444'}}>*</span></label>
                <input type="date" value={aeDate} max={today} onChange={e=>setAeDate(e.target.value)} />
              </div>
            </div>
            <div style={{marginTop:'.75rem'}}><label>Work Done <span style={{color:'#EF4444'}}>*</span></label>
              <textarea rows={3} value={aeWork} onChange={e=>setAeWork(e.target.value)} placeholder="Describe work done on that day…" />
            </div>
            <div><label>Blockers <span style={{color:'#94A3B8',fontWeight:400}}>(optional)</span></label>
              <textarea rows={2} value={aeBlockers} onChange={e=>setAeBlockers(e.target.value)} placeholder="Any blockers or issues?" />
            </div>
            <div style={{marginBottom:'.75rem'}}><label>Workload Level <span style={{color:'#EF4444'}}>*</span></label>
              <div style={{display:'flex',gap:'.625rem',marginTop:'.375rem'}}>
                {(['light','medium','heavy'] as const).map(w=>(
                  <div key={w} className={`wl-opt ${w}`} style={{flex:1}}>
                    <input type="radio" name="ae-workload" id={`ae-wl-${w}`} value={w} checked={aeWorkload===w} onChange={()=>setAeWorkload(w)} />
                    <label htmlFor={`ae-wl-${w}`}>{w==='light'?'🟢 Light':w==='medium'?'🟡 Medium':'🔴 Heavy'}</label>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleAddEntry} disabled={adding}
              style={{padding:'.375rem .75rem',background:'#2563EB',color:'white',border:'none',borderRadius:'.5rem',fontSize:'.8125rem',cursor:'pointer',fontWeight:500,opacity:adding?.6:1}}>
              {adding?'Adding…':'➕ Add Entry'}
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:'.75rem',flexWrap:'wrap',marginBottom:'1.25rem',alignItems:'flex-end',background:'white',padding:'1rem',borderRadius:'.75rem',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
        <div style={{flex:1,minWidth:140}}>
          <label>From Date</label>
          <input type="date" value={from} max={today} onChange={e=>setFrom(e.target.value)} style={{padding:'.5rem .75rem',fontSize:'.875rem'}} />
        </div>
        <div style={{flex:1,minWidth:140}}>
          <label>To Date</label>
          <input type="date" value={to} max={today} onChange={e=>setTo(e.target.value)} style={{padding:'.5rem .75rem',fontSize:'.875rem'}} />
        </div>
        <div style={{flex:1,minWidth:140}}>
          <label>Employee</label>
          <select value={empFilter} onChange={e=>setEmpFilter(e.target.value)} style={{padding:'.5rem .75rem',fontSize:'.875rem'}}>
            <option value="">All Employees</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div style={{display:'flex',alignItems:'flex-end',gap:'.5rem'}}>
          <button onClick={applyFilter} style={{padding:'.5rem .75rem',background:'#2563EB',color:'white',border:'none',borderRadius:'.5rem',fontSize:'.8125rem',cursor:'pointer',fontWeight:500}}>🔍 Filter</button>
          <button onClick={exportCSV} style={{padding:'.5rem .75rem',background:'#F1F5F9',color:'#475569',border:'1px solid #E2E8F0',borderRadius:'.5rem',fontSize:'.8125rem',cursor:'pointer'}}>📥 Export CSV</button>
        </div>
      </div>

      {loading
        ? <div style={{textAlign:'center',padding:'3rem',color:'#94A3B8'}}>Loading…</div>
        : entries.length === 0
        ? <div style={{textAlign:'center',padding:'3rem 1rem',color:'#94A3B8'}}><div style={{fontSize:'2.5rem',marginBottom:'.75rem'}}>🔍</div><p>No entries found.</p></div>
        : (
          <div className="scroll-list">
            <div style={{color:'#64748B',fontSize:'.875rem',marginBottom:'1rem'}}>{entries.length} entries found</div>
            {Object.keys(grouped).sort((a,b)=>b.localeCompare(a)).map(date=>(
              <div key={date}>
                <div style={{fontWeight:600,color:'#475569',fontSize:'.875rem',margin:'1.25rem 0 .625rem',display:'flex',alignItems:'center',gap:'.5rem'}}>
                  <span style={{background:'#E2E8F0',padding:'.2rem .65rem',borderRadius:'9999px'}}>{fmtDate(date)}</span>
                  <span style={{color:'#94A3B8'}}>{grouped[date].length} submission{grouped[date].length>1?'s':''}</span>
                </div>
                {grouped[date].map(e=><EntryCard key={e.id} entry={e} showName onDelete={handleDelete} />)}
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
