import type React from 'react'

export const FONT = `-apple-system, 'SF Pro Display', 'SF Pro Text', sans-serif`

export const CARD: React.CSSProperties = {
  background: 'white',
  borderRadius: 16,
  boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 2px 16px rgba(0,0,0,0.05)',
}

export function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
