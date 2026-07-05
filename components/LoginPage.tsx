'use client'
import { useState } from 'react'
import { Session } from '@/lib/types'
import { FONT } from '@/lib/ui'

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
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'radial-gradient(1200px 600px at 50% -10%, rgba(51,57,138,0.08), transparent), #f6f7fb', fontFamily: FONT }}>
      <div style={{ width: '100%', maxWidth: 340, padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/meril-logo.svg" alt="Meril" style={{ height: 32, width: 'auto', display: 'inline-block', marginBottom: 16 }} />
          <div style={{ width: 36, height: 3, borderRadius: 2, background: '#fdc814', margin: '0 auto 14px' }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 4, color: '#33398a', fontFamily: FONT }}>
            Daily Tracker
          </h1>
          <p style={{ fontSize: 14, color: '#5b6070', fontFamily: FONT }}>
            Sign in to submit your daily update
          </p>
        </div>

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
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#33398a', fontFamily: FONT, fontSize: 13, fontWeight: 500, padding: '4px 6px' }}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ width: '100%', padding: '13px 22px', background: '#33398a', color: 'white', border: 'none', borderRadius: 12, fontSize: 17, fontWeight: 700, fontFamily: FONT, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '-0.01em', transition: 'opacity .12s', boxShadow: '0 4px 14px rgba(51,57,138,0.28)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

      </div>
    </div>
  )
}
