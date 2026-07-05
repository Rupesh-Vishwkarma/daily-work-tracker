import type React from 'react'

// Meril Academy brand (merilacademy.global): Manrope stands in for Gilroy.
export const FONT = `'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif`

// Brand palette
export const BRAND = {
  navy: '#33398a',
  navyDark: '#282d6e',
  purple: '#4b3e9d',
  gold: '#fdc814',
  ink: '#0a1d20',
  bg: '#f6f7fb',
  border: '#e2e2e2',
} as const

export const CARD: React.CSSProperties = {
  background: 'white',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(16,24,64,0.04), 0 6px 24px rgba(16,24,64,0.06)',
  border: '1px solid #eef0f6',
}

export function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
