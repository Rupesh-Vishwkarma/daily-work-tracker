'use client'
import { useState, useEffect, useCallback } from 'react'
import { Entry, Employee } from '@/lib/types'

function getTodayStr() { return new Date().toISOString().slice(0, 10) }
function getLastNDays(n: number) {
  return Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(n-1-i));return d.toISOString().slice(0,10)})
}

export default function WorkloadTab() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const days = getLastNDays(7)
    const [eRes, empRes] = await Promise.all([
      fetch(`/api/entries?from=${days[0]}&to=${getTodayStr()}`),
      fetch('/api/employees')
    ])
    const [eData, empData] = await Promise.all([eRes.json(), empRes.json()])
    setEntries(eData.entries || [])
    setEmployees(empData.employees || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{textAlign:'center',padding:'3rem',color:'#94A3B8'}}>Loading…</div>

  const today = getTodayStr()
  const days7 = getLastNDays(7)
  const todayEntries = entries.filter(e=>e.date===today)

  const trendData = days7.map(d=>{
    const de = entries.filter(e=>e.date===d)
    return {
      label: new Date(d+'T12:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'}),
      heavy: de.filter(e=>e.workload==='heavy').length,
      medium: de.filter(e=>e.workload==='medium').length,
      light: de.filter(e=>e.workload==='light').length,
    }
  })

  const empSummary = employees.map(emp=>{
    const my = entries.filter(e=>e.employee_id===emp.id)
    return {name:emp.name,total:my.length,heavy:my.filter(e=>e.workload==='heavy').length,medium:my.filter(e=>e.workload==='medium').length,light:my.filter(e=>e.workload==='light').length}
  }).filter(e=>e.total>0).sort((a,b)=>b.heavy-a.heavy)

  const todayH = todayEntries.filter(e=>e.workload==='heavy').length
  const todayM = todayEntries.filter(e=>e.workload==='medium').length
  const todayL = todayEntries.filter(e=>e.workload==='light').length
  const todayTotal = todayEntries.length

  const maxBar = Math.max(...trendData.map(d=>d.heavy+d.medium+d.light), 1)

  return (
    <div>
      <div style={{fontSize:'1.0625rem',fontWeight:600,marginBottom:'1.25rem'}}>📊 Workload Analytics</div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginBottom:'1.25rem'}}>
        {/* Today's donut (visual approximation) */}
        <div style={{background:'white',borderRadius:'.75rem',padding:'1.5rem',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          <div style={{fontWeight:600,fontSize:'1rem',marginBottom:'1rem'}}>Today&apos;s Workload Distribution</div>
          {todayTotal===0
            ? <div style={{textAlign:'center',padding:'2rem',color:'#94A3B8'}}>No data for today yet.</div>
            : (
              <div>
                {[{label:'🔴 Heavy',count:todayH,color:'#EF4444'},{label:'🟡 Medium',count:todayM,color:'#F59E0B'},{label:'🟢 Light',count:todayL,color:'#10B981'}].map(row=>(
                  <div key={row.label} style={{marginBottom:'.75rem'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'.875rem',marginBottom:'.25rem'}}>
                      <span>{row.label}</span>
                      <span style={{fontWeight:600}}>{row.count} <span style={{color:'#94A3B8',fontWeight:400}}>({todayTotal?Math.round(row.count/todayTotal*100):0}%)</span></span>
                    </div>
                    <div style={{height:10,background:'#F1F5F9',borderRadius:9999,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${todayTotal?row.count/todayTotal*100:0}%`,background:row.color,borderRadius:9999,transition:'width .3s'}} />
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* 7-day trend */}
        <div style={{background:'white',borderRadius:'.75rem',padding:'1.5rem',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          <div style={{fontWeight:600,fontSize:'1rem',marginBottom:'1rem'}}>7-Day Workload Trend</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:6,height:180}}>
            {trendData.map(d=>{
              const total=d.heavy+d.medium+d.light
              return (
                <div key={d.label} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <div style={{width:'100%',display:'flex',flexDirection:'column',justifyContent:'flex-end',height:150}}>
                    {total===0
                      ? <div style={{height:4,background:'#E2E8F0',borderRadius:4}} />
                      : <>
                          <div style={{height:`${d.heavy/maxBar*140}px`,background:'#EF4444',borderRadius:'4px 4px 0 0'}} />
                          <div style={{height:`${d.medium/maxBar*140}px`,background:'#F59E0B'}} />
                          <div style={{height:`${d.light/maxBar*140}px`,background:'#10B981',borderRadius:'0 0 4px 4px'}} />
                        </>
                    }
                  </div>
                  <div style={{fontSize:'.7rem',color:'#64748B',textAlign:'center',lineHeight:1.2}}>{d.label}</div>
                </div>
              )
            })}
          </div>
          <div style={{display:'flex',gap:'1rem',marginTop:'.75rem',justifyContent:'center',fontSize:'.8125rem'}}>
            {[{c:'#EF4444',l:'Heavy'},{c:'#F59E0B',l:'Medium'},{c:'#10B981',l:'Light'}].map(x=>(
              <span key={x.l} style={{display:'flex',alignItems:'center',gap:.4*16}}><span style={{width:10,height:10,background:x.c,borderRadius:2,display:'inline-block'}}></span>{x.l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Employee summary table */}
      <div style={{background:'white',borderRadius:'.75rem',padding:'1.5rem',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
        <div style={{fontWeight:600,fontSize:'1rem',marginBottom:'1rem'}}>This Week&apos;s Employee Summary</div>
        {empSummary.length===0
          ? <div style={{textAlign:'center',padding:'1rem',color:'#94A3B8'}}>No data for this week yet.</div>
          : (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.875rem'}}>
                <thead>
                  <tr style={{background:'#F8FAFC'}}>
                    {['Employee','Total Days','🔴 Heavy','🟡 Medium','🟢 Light','Status'].map(h=>(
                      <th key={h} style={{padding:'.625rem .875rem',textAlign:'left',fontWeight:600,color:'#475569',borderBottom:'1px solid #E2E8F0',whiteSpace:'nowrap',fontSize:'.8125rem'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empSummary.map(e=>(
                    <tr key={e.name} style={{borderBottom:'1px solid #F1F5F9'}}>
                      <td style={{padding:'.625rem .875rem',fontWeight:600}}>{e.name}</td>
                      <td style={{padding:'.625rem .875rem'}}>{e.total}</td>
                      <td style={{padding:'.625rem .875rem',color:'#DC2626',fontWeight:e.heavy>2?700:400}}>{e.heavy}</td>
                      <td style={{padding:'.625rem .875rem',color:'#D97706'}}>{e.medium}</td>
                      <td style={{padding:'.625rem .875rem',color:'#059669'}}>{e.light}</td>
                      <td style={{padding:'.625rem .875rem'}}>
                        {e.heavy>2
                          ? <span className="badge badge-heavy">High Load</span>
                          : e.heavy>0
                          ? <span className="badge badge-medium">Moderate</span>
                          : <span className="badge badge-light">Balanced</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  )
}
