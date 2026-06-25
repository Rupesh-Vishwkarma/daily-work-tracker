import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession, COOKIE_NAME } from '@/lib/auth'

// Routes (by path prefix + HTTP method) that require a manager session.
// Anything authenticated but not listed here is available to employees too.
const MANAGER_ONLY: { prefix: string; methods: string[] }[] = [
  { prefix: '/api/employees', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  { prefix: '/api/projects', methods: ['POST', 'PATCH', 'DELETE'] },
  { prefix: '/api/broadcast', methods: ['PUT'] },
  { prefix: '/api/comments', methods: ['POST', 'DELETE'] },
  { prefix: '/api/reviewed', methods: ['GET', 'POST', 'DELETE'] },
  { prefix: '/api/resolved-blockers', methods: ['GET', 'POST', 'DELETE'] },
  { prefix: '/api/entries', methods: ['DELETE'] },
]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Login/logout must be reachable without a session.
  if (pathname.startsWith('/api/auth/')) return NextResponse.next()

  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const method = req.method.toUpperCase()
  const needsManager = MANAGER_ONLY.some(r => pathname.startsWith(r.prefix) && r.methods.includes(method))
  if (needsManager && session.role !== 'manager') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Forward the verified identity to route handlers. We overwrite any
  // client-supplied x-user-* headers so they can't be spoofed.
  const headers = new Headers(req.headers)
  headers.set('x-user-id', session.id)
  headers.set('x-user-role', session.role)
  headers.set('x-user-name', session.name)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: '/api/:path*',
}
