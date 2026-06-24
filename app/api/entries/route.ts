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
  const { employee_id, employee_name, date, workload, project_tasks, is_absent, submitted_by_manager, submit_count } = body

  if (!employee_id || !date || !workload) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const id = `e${Date.now()}${Math.floor(Math.random() * 9999)}`
  const { data, error } = await admin.from('entries').insert([{
    id,
    employee_id,
    employee_name: employee_name || employee_id,
    date,
    workload,
    project_tasks: project_tasks || [],
    is_absent: is_absent || false,
    submitted_by_manager: submitted_by_manager || false,
    submit_count: submit_count || 1,
    timestamp: new Date().toISOString()
  }]).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, project_tasks, workload, submit_count } = body
  if (!id) return NextResponse.json({ error: 'Missing entry id' }, { status: 400 })

  const admin = supabaseAdmin()

  // Server-side edit limit: fetch current entry first
  if (submit_count !== undefined) {
    const { data: existing } = await admin.from('entries').select('submit_count').eq('id', id).single()
    if (existing && (existing.submit_count ?? 1) >= 2) {
      return NextResponse.json({ error: 'Edit limit reached. You can only edit your submission once.' }, { status: 403 })
    }
  }

  const updates: Record<string, unknown> = { timestamp: new Date().toISOString() }
  if (project_tasks !== undefined) updates.project_tasks = project_tasks
  if (workload !== undefined) updates.workload = workload
  if (submit_count !== undefined) updates.submit_count = submit_count

  const { data, error } = await admin.from('entries').update(updates).eq('id', id).select().single()
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
