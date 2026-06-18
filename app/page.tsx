'use client'
import { useState, useEffect } from 'react'
import LoginPage from '@/components/LoginPage'
import EmployeePage from '@/components/EmployeePage'
import ManagerPage from '@/components/ManagerPage'
import { Session } from '@/lib/types'

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('dwt_session')
    if (stored) setSession(JSON.parse(stored))
    setLoading(false)
  }, [])

  function handleLogin(s: Session) {
    sessionStorage.setItem('dwt_session', JSON.stringify(s))
    setSession(s)
  }

  function handleLogout() {
    sessionStorage.removeItem('dwt_session')
    setSession(null)
  }

  if (loading) return null

  if (!session) return <LoginPage onLogin={handleLogin} />
  if (session.role === 'manager') return <ManagerPage session={session} onLogout={handleLogout} />
  return <EmployeePage session={session} onLogout={handleLogout} />
}
