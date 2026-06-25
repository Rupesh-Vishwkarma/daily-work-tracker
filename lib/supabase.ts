import { createClient, SupabaseClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL')
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY')

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

let _admin: SupabaseClient | null = null
export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY')
  _admin = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  return _admin
}
