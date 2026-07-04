import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const admin = supabaseAdmin()
  // Never expose stored passwords to the client (manager resets via PATCH).
  const { data, error } = await admin.from('employees').select('id,username,name,role,created_at').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employees: data })
}

export async function POST(req: NextRequest) {
  const { name, username, password } = await req.json()
  if (!name || !username || !password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: existing } = await admin.from('employees').select('id').eq('username', username.toLowerCase()).single()
  if (existing) return NextResponse.json({ error: 'Username already exists' }, { status: 409 })

  const { data, error } = await admin.from('employees').insert([{
    id: username.toLowerCase(),
    username: username.toLowerCase(),
    name,
    password,
    role: 'employee'
  }]).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employee: data })
}

export async function PATCH(req: NextRequest) {
  const { id, password } = await req.json()
  if (!id || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const admin = supabaseAdmin()
  const { error } = await admin.from('employees').update({ password }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = supabaseAdmin()
  const { error } = await admin.from('employees').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
