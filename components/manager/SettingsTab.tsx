'use client'
import { useState, useEffect, useCallback } from 'react'
import { Employee } from '@/lib/types'

export default function SettingsTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [editingPw, setEditingPw] = useState<Record<string, string>>({})
  const [showEditFor, setShowEditFor] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newUser, setNewUser] = useState('')
  const [newPw, setNewPw] = useState('Work@123')
  const [addMsg, setAddMsg] = useState<{ type: string; text: string } | null>(null)
  const [broadcast, setBroadcast] = useState({ message: '', active: false })
  const [broadcastSaving, setBroadcastSaving] = useState(false)
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null)
  const [entryCount, setEntryCount] = useState(0)

  const load = useCallback(async () => {
    const [empRes, entRes, bRes] = await Promise.all([
      fetch('/api/employees'),
      fetch(`/api/entries?from=2020-01-01&to=${new Date().toISOString().slice(0, 10)}`),
      fetch('/api/broadcast'),
    ])
    const [empData, entData, bData] = await Promise.all([empRes.json(), entRes.json(), bRes.json()])
    setEmployees((empData.employees || []).filter((e: Employee) => e.role === 'employee'))
    setEntryCount((entData.entries || []).length)
    setBroadcast({ message: bData.message || '', active: bData.active || false })
  }, [])

  useEffect(() => { load() }, [load])

  async function saveBroadcast() {
    setBroadcastSaving(true)
    try {
      await fetch('/api/broadcast', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(broadcast) })
      setBroadcastMsg(broadcast.active ? 'Broadcast sent to all employees.' : 'Broadcast deactivated.')
      setTimeout(() => setBroadcastMsg(null), 3000)
    } finally { setBroadcastSaving(false) }
  }

  async function savePassword(empId: string) {
    const pw = editingPw[empId]?.trim()
    if (!pw) return
    await fetch('/api/employees', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: empId, password: pw }) })
    setShowEditFor(null)
    load()
  }

  async function addEmployee() {
    if (!newName || !newUser || !newPw) { setAddMsg({ type: 'error', text: 'All fields are required.' }); return }
    const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim(), username: newUser.trim(), password: newPw.trim() }) })
    const data = await res.json()
    if (!res.ok) { setAddMsg({ type: 'error', text: data.error || 'Failed to add employee.' }); return }
    setAddMsg({ type: 'success', text: `"${newName}" added successfully.` })
    setNewName(''); setNewUser(''); setNewPw('Work@123')
    load()
  }

  async function removeEmployee(id: string, name: string) {
    if (!confirm(`Remove "${name}" from the team? Their entries will be kept.`)) return
    await fetch(`/api/employees?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function clearAllData() {
    if (!confirm('⚠️ Permanently delete ALL work entries? Employee accounts are kept.\n\nAre you sure?')) return
    const res = await fetch(`/api/entries?from=2020-01-01&to=2099-12-31`)
    const data = await res.json()
    await Promise.all((data.entries || []).map((e: { id: string }) => fetch(`/api/entries?id=${e.id}`, { method: 'DELETE' })))
    alert('All entries cleared.')
    load()
  }

  return (
    <div>
      {/* Broadcast */}
      <div className="card card-p" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📢 Team Broadcast</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>Show a message to all employees on their dashboard.</div>

        {broadcastMsg && <div className="alert alert-success">{broadcastMsg}</div>}

        <div style={{ marginBottom: 10 }}>
          <textarea
            value={broadcast.message}
            onChange={e => setBroadcast(b => ({ ...b, message: e.target.value }))}
            placeholder="Write your announcement here… (e.g. 'Team meeting at 4pm today')"
            style={{ minHeight: 80 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, textTransform: 'none', color: 'var(--text)', fontWeight: 500 }}>
            <input type="checkbox" checked={broadcast.active} onChange={e => setBroadcast(b => ({ ...b, active: e.target.checked }))} style={{ width: 16, height: 16 }} />
            Show to employees
          </label>
          <button className="btn btn-primary btn-sm" onClick={saveBroadcast} disabled={broadcastSaving}>
            {broadcastSaving ? 'Saving…' : broadcast.active ? '📢 Send Broadcast' : 'Save (hidden)'}
          </button>
        </div>
      </div>

      {/* Team members */}
      <div className="card card-p" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>👥 Team Members ({employees.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['#', 'Name', 'Username', 'Password', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text4)' }}>—</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>Manager (Shorya)</td>
                <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>Shorya</td>
                <td style={{ padding: '10px 12px', color: 'var(--text4)', fontSize: 12 }}>Supabase Auth</td>
                <td style={{ padding: '10px 12px', color: 'var(--text4)', fontSize: 12 }}>Built-in</td>
              </tr>
              {employees.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text4)' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{e.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text3)', fontFamily: 'monospace' }}>{e.username}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', background: 'var(--bg)' }}>
                    {showEditFor === e.id
                      ? <input type="text" value={editingPw[e.id] ?? e.password}
                          onChange={ev => setEditingPw(p => ({ ...p, [e.id]: ev.target.value }))}
                          style={{ width: 140, padding: '4px 8px', fontSize: 13, fontFamily: 'monospace' }}
                          onKeyDown={ev => { if (ev.key === 'Enter') savePassword(e.id); if (ev.key === 'Escape') setShowEditFor(null) }}
                          autoFocus />
                      : <span style={{ fontSize: 13 }}>{e.password}</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {showEditFor === e.id
                        ? <>
                            <button className="btn btn-sm" style={{ background: 'var(--green)', color: 'white' }} onClick={() => savePassword(e.id)}>✓ Save</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowEditFor(null)}>✕</button>
                          </>
                        : <button className="btn btn-secondary btn-sm" onClick={() => { setShowEditFor(e.id); setEditingPw(p => ({ ...p, [e.id]: e.password })) }}>🔑 Edit</button>
                      }
                      <button className="btn btn-danger btn-sm" onClick={() => removeEmployee(e.id, e.name)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add employee */}
      <div className="card card-p" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>➕ Add Employee</div>
        {addMsg && <div className={`alert alert-${addMsg.type}`}>{addMsg.text}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label>Full Name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Ravi Sharma" />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Username</label>
            <input type="text" value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="e.g. ravi" />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Password</label>
            <input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={addEmployee}>Add Employee</button>
        </div>
      </div>

      {/* Data management */}
      <div className="card card-p">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📦 Data</div>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>Total entries in database: <strong style={{ color: 'var(--text)' }}>{entryCount}</strong></p>
        <button className="btn btn-danger btn-sm" onClick={clearAllData}>🗑 Clear All Entries</button>
      </div>
    </div>
  )
}
