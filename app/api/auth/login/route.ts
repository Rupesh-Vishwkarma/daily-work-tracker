import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { signSession, COOKIE_NAME, SESSION_MAX_AGE, SessionPayload } from '@/lib/auth'

const MANAGER_USERNAME = 'Manager'
const MANAGER_EMAIL = 'ai.merillife@gmail.com'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  }

  let session: Omit<SessionPayload, 'exp'>

  if (username.trim().toLowerCase() === MANAGER_USERNAME.toLowerCase()) {
    // Manager: authenticate against the fixed manager account in Supabase Auth.
    const { error } = await supabase.auth.signInWithPassword({ email: MANAGER_EMAIL, password })
    if (error) return NextResponse.json({ error: 'Invalid manager credentials' }, { status: 401 })
    session = { id: 'manager', username: MANAGER_USERNAME, name: 'Manager', role: 'manager' }
  } else {
    // Employee: check the employees table.
    const admin = supabaseAdmin()
    const { data: employee, error } = await admin
      .from('employees')
      .select('*')
      .eq('username', username.trim().toLowerCase())
      .single()
    if (error || !employee) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    if (employee.password !== password) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    session = { id: employee.id, username: employee.username, name: employee.name, role: 'employee' }
  }

  const token = await signSession({ ...session, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  const res = NextResponse.json({ session })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
