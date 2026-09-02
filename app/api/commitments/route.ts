import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { todayIST, nextWorkingDay, nextWeekSaturday } from '@/lib/dates'

const HORIZONS = ['day', 'week']
// Completed ('done') and Cancelled ('cancelled') are the closing outcomes; Partial
// / Carry Forward both roll a commitment forward via the 'carry' action ('partial'
// / 'missed' remain accepted for old rows). 'cancelled' = the plan changed or was
// dropped, and is excluded from delivery/reliability metrics.
const RESOLVE_STATUSES = ['done', 'partial', 'missed', 'cancelled']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const role = req.headers.get('x-user-role')
  const userId = req.headers.get('x-user-id')

  let employeeId = searchParams.get('employee_id')
  if (role !== 'manager') employeeId = userId

  const admin = supabaseAdmin()

  // Weekly commitments do not auto-carry — they are resolved explicitly and stay
  // visible as a persistent, non-blocking reminder until Completed.

  let query = admin.from('commitments').select('*')
    .order('due_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (employeeId) query = query.eq('employee_id', employeeId)
  const status = searchParams.get('status')
  if (status) query = query.eq('status', status)
  const horizon = searchParams.get('horizon')
  if (horizon) query = query.eq('horizon', horizon)
  const from = searchParams.get('from')
  if (from) query = query.gte('due_date', from)
  const to = searchParams.get('to')
  if (to) query = query.lte('due_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commitments: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const items = Array.isArray(body.commitments) ? body.commitments : [body]
  if (items.length === 0 || items.length > 20) {
    return NextResponse.json({ error: 'Invalid commitments payload' }, { status: 400 })
  }

  const role = req.headers.get('x-user-role')
  const userId = req.headers.get('x-user-id')
  const userName = req.headers.get('x-user-name')

  const rows = []
  for (const item of items) {
    const { text, horizon, due_date, project_id, created_in_entry_id } = item
    let { employee_id, employee_name } = item
    if (role !== 'manager') {
      employee_id = userId
      employee_name = userName || userId
    }
    if (!employee_id || !text?.trim() || !HORIZONS.includes(horizon) || !due_date) {
      return NextResponse.json({ error: 'Missing required commitment fields' }, { status: 400 })
    }
    rows.push({
      id: crypto.randomUUID(),
      employee_id,
      employee_name: employee_name || employee_id,
      project_id: project_id || null,
      horizon,
      text: String(text).slice(0, 2000),
      due_date,
      created_in_entry_id: created_in_entry_id || null,
      status: 'open',
      carry_count: 0,
    })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin.from('commitments').insert(rows).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commitments: data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, action, status, outcome_note, text } = body
  if (!id) return NextResponse.json({ error: 'Missing commitment id' }, { status: 400 })

  const role = req.headers.get('x-user-role')
  const userId = req.headers.get('x-user-id')

  const admin = supabaseAdmin()
  const { data: existing } = await admin.from('commitments')
    .select('employee_id, status, carry_count, due_date, horizon, text, outcome_note').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })
  if (role !== 'manager' && existing.employee_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let updates: Record<string, unknown>
  if (action === 'edit') {
    // Change the wording of a still-open commitment (the plan changed). Only an
    // open commitment can be edited; status and due date are left untouched.
    // A comment is required, and we log the previous wording so the change is
    // recorded as "was ... → now ... — reason".
    if (existing.status !== 'open') {
      return NextResponse.json({ error: 'Only open commitments can be edited' }, { status: 400 })
    }
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Commitment text is required' }, { status: 400 })
    }
    if (!outcome_note?.trim()) {
      return NextResponse.json({ error: 'A comment describing the change is required' }, { status: 400 })
    }
    const oldText = (existing.text || '').trim()
    const newText = String(text).slice(0, 2000)
    const entry = `[${todayIST()}] Edited: "${oldText}" -> "${newText.trim()}" - ${String(outcome_note).trim()}`
    const combined = existing.outcome_note ? `${existing.outcome_note}\n${entry}` : entry
    updates = { text: newText, outcome_note: combined.slice(0, 4000) }
  } else if (action === 'carry') {
    if (existing.status !== 'open') {
      return NextResponse.json({ error: 'Only open commitments can be carried' }, { status: 400 })
    }
    // Daily rolls to the next working day; weekly rolls to next week's Saturday.
    const newDue = existing.horizon === 'week' ? nextWeekSaturday(todayIST()) : nextWorkingDay(todayIST())
    updates = {
      carry_count: (existing.carry_count || 0) + 1,
      due_date: newDue,
      outcome_note: outcome_note ? String(outcome_note).slice(0, 2000) : null,
    }
  } else if (RESOLVE_STATUSES.includes(status)) {
    if (status === 'cancelled' && !outcome_note?.trim()) {
      return NextResponse.json({ error: 'A reason for cancelling is required' }, { status: 400 })
    }
    updates = {
      status,
      outcome_note: outcome_note ? String(outcome_note).slice(0, 2000) : null,
      resolved_at: new Date().toISOString(),
    }
  } else {
    return NextResponse.json({ error: 'Invalid action or status' }, { status: 400 })
  }

  const { data, error } = await admin.from('commitments').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commitment: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing commitment id' }, { status: 400 })

  const admin = supabaseAdmin()
  const { error } = await admin.from('commitments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
