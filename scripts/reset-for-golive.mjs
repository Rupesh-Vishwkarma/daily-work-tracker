// Go-live reset: wipe ALL tracking data for a clean production start.
// Keeps: employees, projects.
// Clears: entries, commitments, comments, reviewed_entries, resolved_blockers,
//         uploaded attachment files, and the broadcast banner.
//
// Run:  node --env-file=.env.local scripts/reset-for-golive.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing Supabase env vars'); process.exit(1) }
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function wipe(table, pkCol) {
  // `not(pk, is, null)` matches every row, satisfying Supabase's required filter.
  const { data, error } = await db.from(table).delete().not(pkCol, 'is', null).select(pkCol)
  if (error) { console.error(`${table}: ERROR ${error.message}`); process.exit(1) }
  console.log(`  ${table.padEnd(18)} deleted ${data.length}`)
}

console.log('Clearing tracking data...')
// Order respects FK dependencies (children before parents).
await wipe('comments', 'id')
await wipe('reviewed_entries', 'entry_id')
await wipe('resolved_blockers', 'key')
await wipe('commitments', 'id')
await wipe('entries', 'id')

console.log('\nResetting broadcast banner...')
{
  const { error } = await db.from('broadcast').update({ message: '', active: false, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) { console.error('  broadcast: ERROR', error.message); process.exit(1) }
  console.log('  broadcast reset to empty/off')
}

console.log('\nClearing attachment storage...')
async function listAll(prefix) {
  const out = []
  const { data, error } = await db.storage.from('attachments').list(prefix, { limit: 1000 })
  if (error) { console.error('  storage list ERROR:', error.message); return out }
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name
    // Folders have no id/metadata; recurse into them.
    if (item.id === null || item.metadata === null) {
      out.push(...await listAll(path))
    } else {
      out.push(path)
    }
  }
  return out
}
{
  const paths = await listAll('')
  if (paths.length === 0) {
    console.log('  no files to remove')
  } else {
    const { error } = await db.storage.from('attachments').remove(paths)
    if (error) { console.error('  storage remove ERROR:', error.message); process.exit(1) }
    console.log(`  removed ${paths.length} file(s)`)
  }
}

console.log('\nGo-live reset complete.')
