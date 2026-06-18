'use client'
import { useState, useEffect } from 'react'
import { Entry, Employee } from '@/lib/types'
import EntryCard from '../EntryCard'

export default function EmployeeTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetch('/api/employees').then(r=>r.json()).then(d=>setEmployees(d.employees||[])) }, [])

  async function loadHistory(empId: string) {
    setSelected(empId)
    if (!empId) { setEntries([]); return }
    setLoading(true)
    const res = await fetch(`/api/entries?employee_id=${empId}&from=2020-01-01&to=${new Date().toISOString().slice(0,10)}`)
    const data = await res.json()
    setEntries(data.entries || [])
    setLoading(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/entries?id=${id}`, { method: 'DELETE' })
    loadHistory(selected)
  }

  const heavy = entries.filter(e=>e.workload==='heavy').length
  const medium = entries.filter(e=>e.workload==='medium').length
  const light = entries.filter(e=>e.workload==='light').length

  return (
    <div>
      <div style={{fontSize:'1.0625rem',fontWeight:600,marginBottom:'1rem'}}>👤 Employee Work History</div>
      <div style={{display:'flex',gap:'.75rem',flexWrap:'wrap',marginBottom:'1.25rem',background:'white',padding:'1rem',borderRadius:'.75rem',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
        <div style={{flex:2}}>
          <label>Select Employee</label>
          <select value={selected} onChange={e=>loadHistory(e.target.value)}>
            <option value="">— Choose an employee —</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {!selected
        ? <div style={{textAlign:'center',padding:'3rem 1rem',color:'#94A3B8'}}><div style={{fontSize:'2.5rem',marginBottom:'.75rem'}}>👆</div><p>Select an employee to view their history.</p></div>
        : loading
        ? <div style={{textAlign:'center',padding:'3rem',color:'#94A3B8'}}>Loading…</div>
        : entries.length === 0
        ? <div style={{textAlign:'center',padding:'3rem 1rem',color:'#94A3B8'}}><div style={{fontSize:'2.5rem',marginBottom:'.75rem'}}>📭</div><p>No submissions yet for this employee.</p></div>
        : (
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:'1rem',marginBottom:'1rem'}}>
              {[{num:entries.length,label:'Total Days',color:'#2563EB'},{num:heavy,label:'🔴 Heavy Days',color:'#EF4444'},{num:medium,label:'🟡 Medium Days',color:'#F59E0B'},{num:light,label:'🟢 Light Days',color:'#10B981'}].map(s=>(
                <div key={s.label} style={{background:'white',borderRadius:'.75rem',padding:'1.25rem 1rem',boxShadow:'0 1px 4px rgba(0,0,0,.06)',textAlign:'center'}}>
                  <div style={{fontSize:'2rem',fontWeight:700,lineHeight:1,color:s.color}}>{s.num}</div>
                  <div style={{fontSize:'.8125rem',color:'#64748B',marginTop:'.375rem'}}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="scroll-list">{entries.map(e=><EntryCard key={e.id} entry={e} onDelete={handleDelete} />)}</div>
          </>
        )
      }
    </div>
  )
}
