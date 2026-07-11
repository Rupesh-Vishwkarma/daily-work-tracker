import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Aggregates everything a manager needs for a performance/appraisal report in one
// call: daily entries, manager comments, commitments, reviewed flags, plus the
// employee and project reference data used to resolve names/colours.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const employeeId = searchParams.get('employee_id')

  const admin = supabaseAdmin()

  let entriesQuery = admin
    .from('entries')
    .select('*')
    .order('date', { ascending: true })
    .order('timestamp', { ascending: true })
  if (from) entriesQuery = entriesQuery.gte('date', from)
  if (to) entriesQuery = entriesQuery.lte('date', to)
  if (employeeId) entriesQuery = entriesQuery.eq('employee_id', employeeId)

  const { data: entries, error: entriesErr } = await entriesQuery
  if (entriesErr) return NextResponse.json({ error: entriesErr.message }, { status: 500 })

  const entryIds = new Set((entries || []).map(e => e.id))

  // Manager comments are entry-level. The comments table is small, so fetch all
  // and keep only those tied to in-scope entries rather than build a huge IN list.
  const { data: allComments, error: commentsErr } = await admin
    .from('comments')
    .select('*')
    .order('timestamp', { ascending: true })
  if (commentsErr) return NextResponse.json({ error: commentsErr.message }, { status: 500 })
  const comments = (allComments || []).filter(c => entryIds.has(c.entry_id))

  let commitmentsQuery = admin
    .from('commitments')
    .select('*')
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: true })
  if (employeeId) commitmentsQuery = commitmentsQuery.eq('employee_id', employeeId)
  if (from) commitmentsQuery = commitmentsQuery.gte('due_date', from)
  if (to) commitmentsQuery = commitmentsQuery.lte('due_date', to)
  const { data: commitments, error: commitmentsErr } = await commitmentsQuery
  if (commitmentsErr) return NextResponse.json({ error: commitmentsErr.message }, { status: 500 })

  const { data: reviewed } = await admin.from('reviewed_entries').select('entry_id')
  const reviewed_ids = (reviewed || []).map(r => r.entry_id)

  const { data: employees } = await admin
    .from('employees')
    .select('id,username,name,role,created_at')
    .order('name')
  const { data: projects } = await admin.from('projects').select('*')

  return NextResponse.json({
    entries: entries || [],
    comments,
    commitments: commitments || [],
    reviewed_ids,
    employees: employees || [],
    projects: projects || [],
  })
}
