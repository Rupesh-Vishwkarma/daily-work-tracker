'use client'
import { useState, useEffect } from 'react'
import LoginPage from '@/components/LoginPage'
import EmployeePage from '@/components/EmployeePage'
import ManagerPage from '@/components/ManagerPage'
import { Session } from '@/lib/types'

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Expose a global so child components can trigger logout on 401.
  useEffect(() => {
    const stored = sessionStorage.getItem('dwt_session')
    if (stored) {
      // Verify the session cookie is still valid by probing a lightweight endpoint.
      // This catches the case where a pre-v5 sessionStorage entry exists but the
      // server-side cookie hasn't been set yet (first load after v5 upgrade).
      fetch('/api/broadcast')
        .then(r => {
          if (r.status === 401) {
            sessionStorage.removeItem('dwt_session')
            // stay on login page
          } else {
            setSession(JSON.parse(stored))
          }
        })
        .catch(() => { setSession(JSON.parse(stored)) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  function handleLogin(s: Session) {
    sessionStorage.setItem('dwt_session', JSON.stringify(s))
    setSession(s)
  }

  function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    sessionStorage.removeItem('dwt_session')
    setSession(null)
  }

  if (loading) return null

  if (!session) return <LoginPage onLogin={handleLogin} />
  if (session.role === 'manager') return <ManagerPage session={session} onLogout={handleLogout} />
  return <EmployeePage session={session} onLogout={handleLogout} />
}
