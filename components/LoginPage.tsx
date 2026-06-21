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
    if (!username || !password) { setError('Enter your username and password.'); return }
    setLoading(true); setError('')
    try {
      const isManager = username.trim().toLowerCase() === MANAGER_USERNAME.toLowerCase()
      const endpoint = isManager ? '/api/auth/manager-login' : '/api/auth/login'
      const body = isManager ? { email: MANAGER_EMAIL, password } : { username, password }
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed.'); return }
      onLogin(data.session)
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'linear-gradient(160deg, #E8F4FF 0%, #F2F2F7 100%)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, background: 'var(--blue)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32, boxShadow: '0 8px 24px rgba(0,122,255,0.3)' }}>📋</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Work Tracker</h1>
          <p style={{ fontSize: 14, color: 'var(--text3)' }}>Daily updates for the XR team</p>
        </div>

        {/* Card */}
        <div className="card card-p" style={{ padding: 28 }}>
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div style={{ marginBottom: 14 }}>
            <label>Username</label>
            <input type="text" value={username} placeholder="e.g. rupesh"
              onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={password} placeholder="••••••••"
                onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ paddingRight: 44 }} />
              <button onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text3)' }}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button className="btn btn-primary btn-full" onClick={handleLogin} disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />Signing in…</> : 'Sign In →'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text4)' }}>
          Manager: use username <strong style={{ color: 'var(--text3)' }}>Shorya</strong>
        </p>
      </div>
    </div>
  )
}
