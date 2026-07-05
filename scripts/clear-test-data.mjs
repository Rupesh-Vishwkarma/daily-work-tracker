// Remove all seeded test data (rows whose id starts with "seed-").
// Run:  node --env-file=.env.local scripts/clear-test-data.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing Supabase env vars'); process.exit(1) }
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const c = await db.from('commitments').delete().like('id', 'seed-%').select('id')
if (c.error) { console.error('commitments error:', c.error.message); process.exit(1) }
const e = await db.from('entries').delete().like('id', 'seed-%').select('id')
if (e.error) { console.error('entries error:', e.error.message); process.exit(1) }
console.log(`Cleared ${e.data.length} entries and ${c.data.length} commitments.`)
