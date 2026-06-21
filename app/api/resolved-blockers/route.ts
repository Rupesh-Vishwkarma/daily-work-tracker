import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// key format: "{entry_id}:{task_index}"
export async function GET() {
  const admin = supabaseAdmin()
  const { data, error } = await admin.from('resolved_blockers').select('key')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resolved_keys: data?.map(r => r.key) || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { key } = body
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  const admin = supabaseAdmin()
  const { error } = await admin.from('resolved_blockers').upsert({ key, resolved_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  const admin = supabaseAdmin()
  const { error } = await admin.from('resolved_blockers').delete().eq('key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
