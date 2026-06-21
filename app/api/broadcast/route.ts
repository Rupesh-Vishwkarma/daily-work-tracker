import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const admin = supabaseAdmin()
  const { data, error } = await admin.from('broadcast').select('*').eq('id', 1).single()
  if (error) return NextResponse.json({ message: '', active: false })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { message, active } = body

  const admin = supabaseAdmin()
  const { data, error } = await admin.from('broadcast').upsert({
    id: 1, message: message ?? '', active: active ?? false,
    updated_at: new Date().toISOString()
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
