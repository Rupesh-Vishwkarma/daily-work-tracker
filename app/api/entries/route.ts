import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const employeeId = searchParams.get('employee_id')
  const today = searchParams.get('today')

  const admin = supabaseAdmin()
  let query = admin.from('entries').select('*').order('date', { ascending: false }).order('timestamp', { ascending: false })

  if (today) {
    query = query.eq('date', today)
  } else {
    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)
  }
  if (employeeId) query = query.eq('employee_id', employeeId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { employee_id, employee_name, date, work, blockers, workload } = body

  if (!employee_id || !date || !work || !workload) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin.from('entries').insert([{
    employee_id,
    employee_name,
    date,
    work,
    blockers: blockers || '',
    workload,
    timestamp: new Date().toISOString()
  }]).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing entry id' }, { status: 400 })

  const admin = supabaseAdmin()
  const { error } = await admin.from('entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
