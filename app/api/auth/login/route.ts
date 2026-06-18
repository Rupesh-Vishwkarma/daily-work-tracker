import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

const MANAGER_USERNAME = 'Shorya'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  }

  // Manager: authenticate via Supabase Auth
  if (username.trim().toLowerCase() === MANAGER_USERNAME.toLowerCase()) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: password.includes('@') ? password : username, password })
    // Manager login uses email+password stored in Supabase Auth
    // We pass email as username field from the frontend for manager
    if (error) return NextResponse.json({ error: 'Invalid manager credentials' }, { status: 401 })
    return NextResponse.json({
      session: { id: 'manager', username: MANAGER_USERNAME, name: 'Shorya S', role: 'manager' },
      access_token: data.session?.access_token
    })
  }

  // Employee: check employees table
  const admin = supabaseAdmin()
  const { data: employees, error } = await admin
    .from('employees')
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .single()

  if (error || !employees) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  if (employees.password !== password) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })

  return NextResponse.json({
    session: { id: employees.id, username: employees.username, name: employees.name, role: 'employee' }
  })
}
