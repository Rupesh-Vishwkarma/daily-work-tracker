import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { todayIST } from '@/lib/dates'
import { weekBoundsFor } from '@/lib/summary'
import { sendWeek } from '@/lib/weekly'

// AI generation + email can exceed the 10s serverless default.
export const maxDuration = 60

// Sunday cron (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET"
// automatically when the CRON_SECRET env var is set on the project.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // On Sunday, weekBoundsFor(today) resolves to the just-finished Mon–Sat week
  // (lib/dates.ts treats Sunday as belonging to the week that just ended).
  const today = todayIST()
  const { weekStart } = weekBoundsFor(today)

  try {
    // Idempotency: never double-send a week that already went out.
    const admin = supabaseAdmin()
    const { data: existing } = await admin.from('weekly_summaries')
      .select('sent_at').eq('week_start', weekStart).maybeSingle()
    if (existing?.sent_at) {
      return NextResponse.json({ skipped: true, reason: 'already sent', week_start: weekStart })
    }

    const summary = await sendWeek(today)
    return NextResponse.json({
      week_start: summary.week_start,
      sent: !!summary.sent_at,
      send_error: summary.send_error,
    })
  } catch (err) {
    console.error('[cron/weekly-summary] failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
