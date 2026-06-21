import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entryId = searchParams.get('entry_id')
  const admin = supabaseAdmin()

  if (entryId) {
    const { data } = await admin.from('reviewed_entries').select('entry_id').eq('entry_id', entryId).maybeSingle()
    return NextResponse.json({ reviewed: !!data })
  }

  const { data, error } = await admin.from('reviewed_entries').select('entry_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reviewed_ids: data?.map(r => r.entry_id) || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { entry_id } = body
  if (!entry_id) return NextResponse.json({ error: 'Missing entry_id' }, { status: 400 })

  const admin = supabaseAdmin()
  const { error } = await admin.from('reviewed_entries').upsert({ entry_id, reviewed_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entryId = searchParams.get('entry_id')
  if (!entryId) return NextResponse.json({ error: 'Missing entry_id' }, { status: 400 })

  const admin = supabaseAdmin()
  const { error } = await admin.from('reviewed_entries').delete().eq('entry_id', entryId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
