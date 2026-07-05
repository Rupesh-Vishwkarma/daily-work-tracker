'use client'
import { useState, useEffect, useCallback } from 'react'
import { Employee } from '@/lib/types'
import { sendNudge } from '@/lib/realtime'

export default function SettingsTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [newName, setNewName] = useState('')
  const [newUser, setNewUser] = useState('')
  const [newPw, setNewPw] = useState('')
  const [addMsg, setAddMsg] = useState<{ type: string; text: string } | null>(null)
  const [broadcast, setBroadcast] = useState({ message: '', active: false })
  const [broadcastSaving, setBroadcastSaving] = useState(false)
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [empRes, bRes] = await Promise.all([
      fetch('/api/employees'),
      fetch('/api/broadcast'),
    ])
    const [empData, bData] = await Promise.all([empRes.json(), bRes.json()])
    setEmployees((empData.employees || []).filter((e: Employee) => e.role === 'employee'))
    setBroadcast({ message: bData.message || '', active: bData.active || false })
  }, [])

  useEffect(() => { load() }, [load])

  async function saveBroadcast() {
    setBroadcastSaving(true)
    try {
      await fetch('/api/broadcast', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(broadcast) })
      // No employeeId → every logged-in employee refreshes their banner.
      sendNudge('manager_changed', { kind: 'broadcast' })
      setBroadcastMsg(broadcast.active ? 'Broadcast sent to all employees.' : 'Broadcast deactivated.')
      setTimeout(() => setBroadcastMsg(null), 3000)
    } finally { setBroadcastSaving(false) }
  }

  async function resetPassword(empId: string, name: string) {
    const pw = window.prompt(`Set a new password for ${name}:`)
    if (pw === null) return
    if (!pw.trim()) { alert('Password cannot be empty.'); return }
    const res = await fetch('/api/employees', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: empId, password: pw.trim() }) })
    if (!res.ok) { alert('Failed to update password.'); return }
    alert(`Password updated for ${name}. Share it with them directly.`)
  }

  async function addEmployee() {
    if (!newName || !newUser || !newPw) { setAddMsg({ type: 'error', text: 'All fields are required.' }); return }
    const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim(), username: newUser.trim(), password: newPw.trim() }) })
    const data = await res.json()
    if (!res.ok) { setAddMsg({ type: 'error', text: data.error || 'Failed to add employee.' }); return }
    setAddMsg({ type: 'success', text: `"${newName}" added successfully.` })
    setNewName(''); setNewUser(''); setNewPw('')
    load()
  }

  async function removeEmployee(id: string, name: string) {
    if (!confirm(`Remove "${name}" from the team? Their entries will be kept.`)) return
    await fetch(`/api/employees?id=${id}`, { method: 'DELETE' })
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
                {['#', 'Name', 'Username', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text4)' }}>—</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>Manager</td>
                <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>Manager</td>
                <td style={{ padding: '10px 12px', color: 'var(--text4)', fontSize: 12 }}>Supabase Auth</td>
              </tr>
              {employees.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text4)' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{e.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text3)', fontFamily: 'monospace' }}>{e.username}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => resetPassword(e.id, e.name)}>🔑 Reset password</button>
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
            <input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Set a password" />
          </div>
          <button className="btn btn-primary" onClick={addEmployee}>Add Employee</button>
        </div>
      </div>

    </div>
  )
}
