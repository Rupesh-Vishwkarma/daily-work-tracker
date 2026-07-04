import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'attachments'
// Free-tier Supabase Storage is ~1 GB total; keep uploads small (PRD §13).
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain', 'text/csv',
])

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id') || 'unknown'

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 2 MB). Compress the screenshot and retry.' }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const path = `${userId}/${Date.now()}-${safeName}`

  const admin = supabaseAdmin()
  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({
    attachment: {
      type: file.type.startsWith('image/') ? 'image' : 'file',
      url: data.publicUrl,
      name: file.name,
    },
  })
}
