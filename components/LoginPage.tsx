'use client'
import { useState } from 'react'
import { Session } from '@/lib/types'

const MANAGER_EMAIL = 'ai.merillife@gmail.com'
const MANAGER_USERNAME = 'Manager'
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif'

const IS: React.CSSProperties = {
  width: '100%', padding: '13px 16px', border: 'none', borderRadius: 0,
  fontSize: 17, color: '#1D1D1F', background: 'white', outline: 'none',
  fontFamily: FONT, boxSizing: 'border-box', letterSpacing: '-0.01em',
  borderBottom: '1px solid rgba(0,0,0,0.08)',
}

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F5F5F7', fontFamily: FONT }}>
      <div style={{ width: '100%', maxWidth: 340, padding: '0 20px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6, color: '#1D1D1F' }}>
          Daily Work Tracker
        </h1>
        <p style={{ textAlign: 'center', fontSize: 15, color: '#6E6E73', marginBottom: 32 }}>
          Sign in to submit your daily update
        </p>

        {error && (
          <div style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#CC0000', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 0 rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.06)', marginBottom: 10 }}>
          <input
            type="text"
            value={username}
            placeholder="Username"
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={IS}
            autoFocus
          />
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              placeholder="Password"
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ ...IS, paddingRight: 56, borderBottom: 'none' }}
            />
            <button
              onClick={() => setShowPw(v => !v)}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#0071E3', fontFamily: FONT, fontSize: 13, fontWeight: 500, padding: '4px 6px' }}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ width: '100%', padding: '13px 22px', background: '#0071E3', color: 'white', border: 'none', borderRadius: 980, fontSize: 17, fontWeight: 590, fontFamily: FONT, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '-0.01em', transition: 'opacity .12s' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#AEAEB2' }}>
          Manager: use username <strong style={{ color: '#6E6E73' }}>Manager</strong>
        </p>
      </div>
    </div>
  )
}
