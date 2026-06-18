'use client'
import { useState } from 'react'
import { Session } from '@/lib/types'

const MANAGER_EMAIL = 'ai.merillife@gmail.com'
const MANAGER_USERNAME = 'Shorya'

export default function LoginPage({ onLogin }: { onLogin: (s: Session) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!username || !password) { setError('Please enter your username and password.'); return }
    setLoading(true); setError('')

    try {
      const isManager = username.trim().toLowerCase() === MANAGER_USERNAME.toLowerCase()
      const endpoint = isManager ? '/api/auth/manager-login' : '/api/auth/login'
      const body = isManager
        ? { email: MANAGER_EMAIL, password }
        : { username, password }

      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()

      if (!res.ok) { setError(data.error || 'Login failed.'); return }
      onLogin(data.session)
    } catch (err) {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:'1rem', background:'linear-gradient(135deg,#EFF6FF 0%,#F1F5F9 100%)' }}>
      <div style={{ background:'white', borderRadius:'1rem', padding:'2.5rem', width:'100%', maxWidth:'420px', boxShadow:'0 4px 24px rgba(0,0,0,0.1)' }}>
        <div style={{ width:52, height:52, background:'#2563EB', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem', fontSize:'1.5rem' }}>📋</div>
        <h1 style={{ textAlign:'center', fontSize:'1.5rem', fontWeight:700, marginBottom:'.25rem' }}>Daily Work Tracker</h1>
        <p style={{ textAlign:'center', color:'#64748B', fontSize:'.875rem', marginBottom:'2rem' }}>Submit your daily updates &amp; track team progress</p>

        {error && <div style={{ padding:'.875rem 1rem', borderRadius:'.5rem', fontSize:'.9rem', marginBottom:'1rem', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA' }}>{error}</div>}

        <div style={{ marginBottom:'1rem' }}>
          <label>Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Enter your username" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>

        <div style={{ marginBottom:'1rem' }}>
          <label>Password</label>
          <div style={{ position:'relative' }}>
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter password" style={{ paddingRight:'2.75rem' }} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button onClick={() => setShowPw(!showPw)} style={{ position:'absolute', right:'.75rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem' }}>
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <button onClick={handleLogin} disabled={loading}
          style={{ width:'100%', padding:'.75rem', background:'#2563EB', color:'white', border:'none', borderRadius:'.5rem', fontSize:'1rem', fontWeight:500, cursor:'pointer', opacity: loading ? .6 : 1 }}>
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:'.5rem', padding:'.75rem', fontSize:'.8125rem', color:'#1E40AF', marginTop:'1rem' }}>
          <strong>Manager:</strong> Use your Supabase email &amp; password<br />
          <strong>Employees:</strong> Use your assigned username &amp; password
        </div>
      </div>
    </div>
  )
}
