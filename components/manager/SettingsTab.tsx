'use client'
import { useState, useEffect, useCallback } from 'react'
import { Employee } from '@/lib/types'

export default function SettingsTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [editingPw, setEditingPw] = useState<Record<string,string>>({})
  const [showEditFor, setShowEditFor] = useState<string|null>(null)
  const [newName, setNewName] = useState('')
  const [newUser, setNewUser] = useState('')
  const [newPw, setNewPw] = useState('Work@123')
  const [addMsg, setAddMsg] = useState<{type:string;text:string}|null>(null)
  const [entryCount, setEntryCount] = useState(0)

  const load = useCallback(async () => {
    const [empRes, entRes] = await Promise.all([
      fetch('/api/employees'),
      fetch(`/api/entries?from=2020-01-01&to=${new Date().toISOString().slice(0,10)}`)
    ])
    const [empData, entData] = await Promise.all([empRes.json(), entRes.json()])
    setEmployees(empData.employees || [])
    setEntryCount((entData.entries||[]).length)
  }, [])

  useEffect(() => { load() }, [load])

  async function savePassword(empId: string) {
    const pw = editingPw[empId]?.trim()
    if (!pw) return
    await fetch('/api/employees', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:empId, password:pw}) })
    setShowEditFor(null)
    load()
  }

  async function addEmployee() {
    if (!newName || !newUser || !newPw) { setAddMsg({type:'error',text:'All fields are required.'}); return }
    const res = await fetch('/api/employees', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name:newName.trim(),username:newUser.trim(),password:newPw.trim()}) })
    const data = await res.json()
    if (!res.ok) { setAddMsg({type:'error',text:data.error||'Failed to add employee.'}); return }
    setAddMsg({type:'success',text:`Employee "${newName}" added.`})
    setNewName(''); setNewUser(''); setNewPw('Work@123')
    load()
  }

  async function removeEmployee(id: string, name: string) {
    if (!confirm(`Remove "${name}" from the team?\n\nTheir past entries will be kept.`)) return
    await fetch(`/api/employees?id=${id}`, { method:'DELETE' })
    load()
  }

  async function clearAllData() {
    if (!confirm('⚠️ This will permanently delete ALL work entries. Employee accounts will be preserved.\n\nAre you sure?')) return
    // Delete entries one by one or use a batch — for now fetch all and delete
    const res = await fetch(`/api/entries?from=2020-01-01&to=2099-12-31`)
    const data = await res.json()
    await Promise.all((data.entries||[]).map((e: {id:string}) => fetch(`/api/entries?id=${e.id}`, {method:'DELETE'})))
    alert('All entries cleared.')
    load()
  }

  const alertStyle = (type: string) => ({
    padding:'.875rem 1rem', borderRadius:'.5rem', fontSize:'.9rem', marginBottom:'1rem',
    background: type==='success'?'#D1FAE5':'#FEE2E2',
    color: type==='success'?'#065F46':'#991B1B',
    border: `1px solid ${type==='success'?'#A7F3D0':'#FECACA'}`
  })

  return (
    <div>
      <div style={{fontSize:'1.0625rem',fontWeight:600,marginBottom:'1.25rem'}}>⚙️ Settings &amp; Administration</div>

      {/* Team Credentials */}
      <div style={{background:'white',borderRadius:'.75rem',padding:'1.5rem',boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:'1.25rem'}}>
        <div style={{fontWeight:600,fontSize:'1rem',marginBottom:'.5rem'}}>👥 Team Credentials</div>
        <p style={{fontSize:'.875rem',color:'#64748B',marginBottom:'1rem'}}>Manage employee accounts and passwords.</p>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8125rem'}}>
            <thead>
              <tr style={{background:'#F8FAFC'}}>
                {['#','Name','Username','Password','Actions'].map(h=>(
                  <th key={h} style={{padding:'.5rem .75rem',textAlign:'left',fontWeight:600,color:'#475569',border:'1px solid #E2E8F0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{padding:'.5rem .75rem',border:'1px solid #E2E8F0'}}>—</td>
                <td style={{padding:'.5rem .75rem',border:'1px solid #E2E8F0'}}><strong>Manager</strong></td>
                <td style={{padding:'.5rem .75rem',border:'1px solid #E2E8F0'}}>Shorya</td>
                <td style={{padding:'.5rem .75rem',border:'1px solid #E2E8F0',fontFamily:'monospace',background:'#F8FAFC'}}>Via Supabase Auth</td>
                <td style={{padding:'.5rem .75rem',border:'1px solid #E2E8F0',color:'#94A3B8',fontSize:'.75rem'}}>Built-in</td>
              </tr>
              {employees.map((e,i)=>(
                <tr key={e.id}>
                  <td style={{padding:'.5rem .75rem',border:'1px solid #E2E8F0'}}>{i+1}</td>
                  <td style={{padding:'.5rem .75rem',border:'1px solid #E2E8F0'}}>{e.name}</td>
                  <td style={{padding:'.5rem .75rem',border:'1px solid #E2E8F0'}}>{e.username}</td>
                  <td style={{padding:'.5rem .75rem',border:'1px solid #E2E8F0',fontFamily:'monospace',background:'#F8FAFC'}}>
                    {showEditFor===e.id
                      ? <input type="text" value={editingPw[e.id]??e.password} onChange={ev=>setEditingPw(p=>({...p,[e.id]:ev.target.value}))}
                          style={{width:130,padding:'.2rem .4rem',fontSize:'.8125rem',fontFamily:'monospace',border:'1.5px solid #2563EB',borderRadius:'.35rem',outline:'none'}}
                          onKeyDown={ev=>{if(ev.key==='Enter')savePassword(e.id);if(ev.key==='Escape')setShowEditFor(null)}} />
                      : e.password
                    }
                  </td>
                  <td style={{padding:'.5rem .75rem',border:'1px solid #E2E8F0'}}>
                    <div style={{display:'flex',gap:'.4rem',flexWrap:'wrap'}}>
                      {showEditFor===e.id
                        ? <>
                            <button onClick={()=>savePassword(e.id)} style={{padding:'.25rem .6rem',background:'#10B981',color:'white',border:'none',borderRadius:'.375rem',fontSize:'.75rem',cursor:'pointer',fontWeight:600}}>✓ Save</button>
                            <button onClick={()=>setShowEditFor(null)} style={{padding:'.25rem .6rem',background:'#F1F5F9',color:'#475569',border:'1px solid #E2E8F0',borderRadius:'.375rem',fontSize:'.75rem',cursor:'pointer'}}>✕</button>
                          </>
                        : <button onClick={()=>{setShowEditFor(e.id);setEditingPw(p=>({...p,[e.id]:e.password}))}}
                            style={{padding:'.25rem .6rem',background:'#F1F5F9',color:'#475569',border:'1px solid #E2E8F0',borderRadius:'.375rem',fontSize:'.75rem',cursor:'pointer'}}>🔑 Edit PW</button>
                      }
                      <button onClick={()=>removeEmployee(e.id,e.name)}
                        style={{padding:'.25rem .6rem',background:'#EF4444',color:'white',border:'none',borderRadius:'.375rem',fontSize:'.75rem',cursor:'pointer',fontWeight:600}}>✕ Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee */}
      <div style={{background:'white',borderRadius:'.75rem',padding:'1.5rem',boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:'1.25rem'}}>
        <div style={{fontWeight:600,fontSize:'1rem',marginBottom:'1rem'}}>➕ Add New Employee</div>
        <div style={{display:'flex',gap:'.75rem',flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:2,minWidth:160}}>
            <label>Full Name</label>
            <input type="text" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Ravi Sharma" />
          </div>
          <div style={{flex:1,minWidth:130}}>
            <label>Username</label>
            <input type="text" value={newUser} onChange={e=>setNewUser(e.target.value)} placeholder="e.g. ravi" />
          </div>
          <div style={{flex:1,minWidth:130}}>
            <label>Password</label>
            <input type="text" value={newPw} onChange={e=>setNewPw(e.target.value)} />
          </div>
          <button onClick={addEmployee} style={{padding:'.625rem 1.25rem',background:'#10B981',color:'white',border:'none',borderRadius:'.5rem',fontSize:'.9375rem',fontWeight:500,cursor:'pointer'}}>Add Employee</button>
        </div>
        {addMsg && <div style={{...alertStyle(addMsg.type),marginTop:'.75rem',marginBottom:0}}>{addMsg.text}</div>}
      </div>

      {/* Data management */}
      <div style={{background:'white',borderRadius:'.75rem',padding:'1.5rem',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
        <div style={{fontWeight:600,fontSize:'1rem',marginBottom:'1rem'}}>📦 Data Management</div>
        <div style={{display:'flex',gap:'.75rem',flexWrap:'wrap'}}>
          <button onClick={clearAllData} style={{padding:'.625rem 1.25rem',background:'#EF4444',color:'white',border:'none',borderRadius:'.5rem',fontSize:'.9375rem',fontWeight:500,cursor:'pointer'}}>🗑 Clear All Entries</button>
        </div>
        <p style={{fontSize:'.8125rem',color:'#94A3B8',marginTop:'.75rem'}}>Total entries in database: <strong>{entryCount}</strong></p>
      </div>
    </div>
  )
}
