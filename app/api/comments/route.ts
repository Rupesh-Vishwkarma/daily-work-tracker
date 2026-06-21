import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entryId = searchParams.get('entry_id')
  if (!entryId) return NextResponse.json({ error: 'Missing entry_id' }, { status: 400 })

  const admin = supabaseAdmin()
  const { data, error } = await admin.from('comments').select('*').eq('entry_id', entryId).order('timestamp', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { entry_id, text, author } = body
  if (!entry_id || !text) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const admin = supabaseAdmin()
  const { data, error } = await admin.from('comments').insert([{
    entry_id, text, author: author || 'Manager',
    timestamp: new Date().toISOString()
  }]).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = supabaseAdmin()
  const { error } = await admin.from('comments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
