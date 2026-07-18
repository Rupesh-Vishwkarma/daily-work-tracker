import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession, COOKIE_NAME } from '@/lib/auth'

const MANAGER_ONLY: { prefix: string; methods: string[] }[] = [
  { prefix: '/api/employees', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { prefix: '/api/projects', methods: ['POST', 'PATCH', 'DELETE'] },
  { prefix: '/api/broadcast', methods: ['PUT'] },
  { prefix: '/api/comments', methods: ['POST', 'DELETE'] },
  { prefix: '/api/reviewed', methods: ['GET', 'POST', 'DELETE'] },
  { prefix: '/api/resolved-blockers', methods: ['GET', 'POST', 'DELETE'] },
  { prefix: '/api/export', methods: ['GET'] },
  { prefix: '/api/entries', methods: ['DELETE'] },
  { prefix: '/api/commitments', methods: ['DELETE'] },
  { prefix: '/api/weekly-summary', methods: ['GET', 'POST'] },
]

export async function proxy(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl

    if (pathname.startsWith('/api/auth/')) return NextResponse.next()

    // Cron routes authenticate themselves via CRON_SECRET (no session cookie).
    if (pathname.startsWith('/api/cron/')) return NextResponse.next()

    const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const method = req.method.toUpperCase()
    const needsManager = MANAGER_ONLY.some(
      r => pathname.startsWith(r.prefix) && r.methods.includes(method)
    )
    if (needsManager && session.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const headers = new Headers(req.headers)
    headers.set('x-user-id', session.id)
    headers.set('x-user-role', session.role)
    headers.set('x-user-name', session.name)
    return NextResponse.next({ request: { headers } })
  } catch (err) {
    console.error('[proxy] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const config = {
  matcher: '/api/:path*',
}
