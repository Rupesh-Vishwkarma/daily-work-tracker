import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return NextResponse.json({ error: 'Invalid manager credentials' }, { status: 401 })

  return NextResponse.json({
    session: { id: 'manager', username: 'Shorya', name: 'Shorya S', role: 'manager' },
    access_token: data.session?.access_token
  })
}
