'use client'
import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

// ── Realtime "nudge" bus ──────────────────────────────────────────────────────
// Instead of polling on a timer, clients open a single Supabase Broadcast channel
// and push a tiny signal whenever they write something. Other clients hear the
// signal and re-fetch through the normal (access-controlled) API.
//
// Broadcast never touches the database, so no row data crosses the socket and the
// existing "RLS off + service-role server-side" security model is unaffected.
// The payload only ever carries an event name plus a non-sensitive employee id.

const CHANNEL_NAME = 'team-tracking'

export type NudgeEvent = 'manager_changed' | 'employee_changed'

export interface NudgePayload {
  // Optional target. When present, only that employee needs to react.
  // Absent means "everyone" (e.g. a team-wide broadcast).
  employeeId?: string
  // Free-form hint about what changed (note, review, absent, broadcast, …).
  kind?: string
}

type Handler = (payload: NudgePayload) => void

const handlers: Record<NudgeEvent, Set<Handler>> = {
  manager_changed: new Set(),
  employee_changed: new Set(),
}

let channel: RealtimeChannel | null = null

function ensureChannel(): RealtimeChannel {
  if (channel) return channel
  // self: false → the sender does not receive its own broadcast, so a client
  // never re-fetches in response to its own write.
  const ch = supabase.channel(CHANNEL_NAME, { config: { broadcast: { self: false } } })
  ;(Object.keys(handlers) as NudgeEvent[]).forEach(event => {
    ch.on('broadcast', { event }, msg => {
      const payload = (msg?.payload as NudgePayload) || {}
      handlers[event].forEach(h => { try { h(payload) } catch { /* isolate handler errors */ } })
    })
  })
  ch.subscribe()
  channel = ch
  return ch
}

/** Fire-and-forget signal that something changed. Safe to call even if realtime is unavailable. */
export function sendNudge(event: NudgeEvent, payload: NudgePayload = {}): void {
  try {
    ensureChannel().send({ type: 'broadcast', event, payload })
  } catch { /* best-effort; a missed nudge just means a manual refresh is needed */ }
}

/** Subscribe a component to a nudge event. The handler always sees the latest closure. */
export function useNudge(event: NudgeEvent, handler: Handler): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    ensureChannel()
    const wrapped: Handler = p => ref.current(p)
    handlers[event].add(wrapped)
    return () => { handlers[event].delete(wrapped) }
  }, [event])
}
