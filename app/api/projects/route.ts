import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const admin = supabaseAdmin()
  const { data, error } = await admin.from('projects').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projects: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, name, color, lead, members, start_date, deadline } = body
  if (!id || !name) return NextResponse.json({ error: 'id and name are required' }, { status: 400 })

  const admin = supabaseAdmin()
  const { data, error } = await admin.from('projects').insert([{
    id,
    name,
    color: color || '#007AFF',
    lead: lead || '',
    members: members || [],
    start_date: start_date || new Date().toISOString().slice(0, 10),
    deadline: deadline || null,
    status: 'active',
    previous_deadlines: [],
  }]).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'Missing project id' }, { status: 400 })

  const admin = supabaseAdmin()
  const { data, error } = await admin.from('projects').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing project id' }, { status: 400 })

  const admin = supabaseAdmin()
  const { error } = await admin.from('projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
