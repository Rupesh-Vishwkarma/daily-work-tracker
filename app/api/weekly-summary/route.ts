import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { todayIST } from '@/lib/dates'
import { generateAndStore, sendWeek } from '@/lib/weekly'

// AI generation + email can exceed the 10s serverless default (esp. on Vercel).
export const maxDuration = 60

// Manager-only (enforced in proxy.ts). GET lists stored summaries or fetches one.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const weekStart = searchParams.get('week_start')
  const admin = supabaseAdmin()

  if (weekStart) {
    const { data, error } = await admin.from('weekly_summaries')
      .select('*').eq('week_start', weekStart).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ summary: data })
  }

  const { data, error } = await admin.from('weekly_summaries')
    .select('*').order('week_start', { ascending: false }).limit(26)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ summaries: data })
}

// POST { action: 'generate' | 'send', week_start? }
export async function POST(req: NextRequest) {
  let body: { action?: string; week_start?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const target = body.week_start || todayIST()

  try {
    if (body.action === 'generate') {
      const summary = await generateAndStore(target)
      return NextResponse.json({ summary })
    }
    if (body.action === 'send') {
      const summary = await sendWeek(target)
      return NextResponse.json({ summary })
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[weekly-summary] action failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
