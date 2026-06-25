// Signed session tokens (HMAC-SHA256) using the Web Crypto API.
// Works in both the Node.js runtime (route handlers) and the Proxy runtime.
import type { Role } from './types'

export const COOKIE_NAME = 'dwt_auth'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days, in seconds

export interface SessionPayload {
  id: string
  username: string
  name: string
  role: Role
  exp: number // epoch ms
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function getSecret(): string {
  // Prefer a dedicated secret; fall back to the service-role key so the app keeps
  // working without extra configuration. Set SESSION_SECRET in production.
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Missing env var: SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY)')
  return secret
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlToBytes(s: string): Uint8Array {
  let str = s.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(getSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return bytesToB64url(new Uint8Array(sig))
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = bytesToB64url(encoder.encode(JSON.stringify(payload)))
  const sig = await hmac(body)
  return `${body}.${sig}`
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  try {
    const expected = await hmac(body)
    if (!timingSafeEqual(sig, expected)) return null
    const payload = JSON.parse(decoder.decode(b64urlToBytes(body))) as SessionPayload
    if (!payload.exp || Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
