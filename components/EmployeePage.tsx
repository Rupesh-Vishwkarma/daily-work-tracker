'use client'
import { useState, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { Session, Entry, Project, ProjectTask, TaskStatus, Workload, Comment, Commitment, Attachment } from '@/lib/types'
import { FONT, CARD, fmtDate as FMT_DATE } from '@/lib/ui'
import { todayIST, nextWorkingDay, weekSaturday, dayOfWeek } from '@/lib/dates'
import { uploadAttachment } from '@/lib/upload'
import { useNudge, sendNudge } from '@/lib/realtime'

const TODAY = todayIST

const TASK_STATUS: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  completed:   { label: 'Done',        color: '#34C759', bg: 'rgba(52,199,89,0.1)' },
  in_progress: { label: 'In Progress', color: '#33398a', bg: 'rgba(51,57,138,0.1)' },
  blocked:     { label: 'Blocked',     color: '#FF3B30', bg: 'rgba(255,59,48,0.1)' },
}
const WL: Record<Workload, { label: string; color: string; bg: string }> = {
  light:  { label: 'Light',  color: '#34C759', bg: 'rgba(52,199,89,0.1)' },
  medium: { label: 'Medium', color: '#FF9500', bg: 'rgba(255,149,0,0.1)' },
  heavy:  { label: 'Heavy',  color: '#FF3B30', bg: 'rgba(255,59,48,0.1)' },
}

const OUTCOME: Record<string, { label: string; color: string }> = {
  done:    { label: 'Done',    color: '#34C759' },
  partial: { label: 'Partial', color: '#FF9500' },
  missed:  { label: 'Missed',  color: '#FF3B30' },
}

// Small uppercase field label used across the task form.
const LBL = { display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: '#8a90a2', marginBottom: 5 }

// Consistent pill "chip" for the task action bar (blocker / screenshot / link).
const CHIP = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
  borderRadius: 980, fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
  borderWidth: 1, borderStyle: 'solid', borderColor: '#e2e2e2',
  backgroundColor: 'white', color: '#5b6070', lineHeight: 1,
  textTransform: 'none' as const, letterSpacing: 'normal', marginBottom: 0, transition: 'all .15s',
}

interface LocalTask extends ProjectTask {
  uid: number
  showBlockers: boolean
  uploading?: boolean
  showLink?: boolean
  linkDraft?: string
}

interface LocalPromise {
  uid: number
  text: string
  project_id: string
}

function mkTask(): LocalTask {
  return { uid: Date.now() + Math.random(), project_id: '', task: '', time: '', status: 'in_progress', blockers: '', what_changed: '', attachments: [], showBlockers: false, showLink: false, linkDraft: '' }
}

function mkPromise(): LocalPromise {
  return { uid: Date.now() + Math.random(), text: '', project_id: '' }
}

function toLocalTask(t: ProjectTask): LocalTask {
  return { ...t, what_changed: t.what_changed || '', attachments: t.attachments || [], uid: Date.now() + Math.random(), showBlockers: !!t.blockers }
}

function toProjectTask({ uid: _u, showBlockers: _s, uploading: _up, showLink: _sl, linkDraft: _ld, ...rest }: LocalTask): ProjectTask {
  return rest
}

function projectPill(proj: Project | undefined, other: boolean) {
  if (proj) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 600, background: proj.color + '18', color: proj.color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: proj.color, flexShrink: 0 }} />{proj.name}
    </span>
  )
  if (other) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,0.06)', color: '#6E6E73' }}>Other Work</span>
  )
  return null
}

// ── Attachment chips (shared display) ─────────────────────────────────────────
// Open in a single new tab; preventDefault + stopPropagation so the native anchor
// navigation and any ancestor click handler don't each fire (would open extra tabs).
function openAttachment(e: ReactMouseEvent, url: string) {
  e.preventDefault()
  e.stopPropagation()
  window.open(url, '_blank', 'noopener,noreferrer')
}

function AttachmentChips({ attachments, onRemove }: { attachments: Attachment[]; onRemove?: (i: number) => void }) {
  if (!attachments.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {attachments.map((a, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F5F5F7', borderRadius: 8, padding: '4px 8px', maxWidth: '100%' }}>
          {a.type === 'image' ? (
            <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={e => openAttachment(e, a.url)} style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
              <span style={{ fontSize: 11, color: '#6E6E73', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
            </a>
          ) : (
            <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={e => openAttachment(e, a.url)} style={{ fontSize: 12, color: '#33398a', textDecoration: 'none', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.type === 'link' ? '🔗 ' : '📄 '}{a.name || a.url}
            </a>
          )}
          {onRemove && (
            <button onClick={e => { e.stopPropagation(); onRemove(i) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', fontSize: 14, lineHeight: 1, padding: 0, fontFamily: FONT }}>×</button>
          )}
        </span>
      ))}
    </div>
  )
}

// ── Task display (submitted view) ─────────────────────────────────────────────
function TaskDisplay({ tasks, projects }: { tasks: ProjectTask[]; projects: Project[] }) {
  if (!tasks || tasks.length === 0) return <p style={{ color: '#AEAEB2', fontSize: 13, fontStyle: 'italic' }}>No tasks logged.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.map((t, i) => {
        const proj = projects.find(p => p.id === t.project_id)
        const si = TASK_STATUS[t.status] || TASK_STATUS.in_progress
        return (
          <div key={i} style={{ background: '#F5F5F7', borderRadius: 12, padding: '12px 14px', borderLeft: `3px solid ${proj?.color || 'rgba(0,0,0,0.12)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              {projectPill(proj, t.project_id === '__other__')}
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 700, background: si.bg, color: si.color }}>{si.label}</span>
              {t.time && <span style={{ fontSize: 11, color: '#AEAEB2', marginLeft: 'auto' }}>{t.time}h</span>}
            </div>
            <div style={{ color: '#1D1D1F', fontSize: 14, lineHeight: 1.55 }}>{t.task}</div>
            {t.what_changed && (
              <div style={{ fontSize: 13, color: '#3C3C43', background: 'rgba(51,57,138,0.05)', padding: '8px 12px', borderRadius: 8, borderLeft: '3px solid rgba(51,57,138,0.35)', marginTop: 8, lineHeight: 1.5 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#33398a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>What changed</div>
                {t.what_changed}
              </div>
            )}
            <AttachmentChips attachments={t.attachments || []} />
            {t.blockers && (
              <div style={{ fontSize: 13, color: '#B25900', background: 'rgba(255,149,0,0.08)', padding: '8px 12px', borderRadius: 8, borderLeft: '3px solid #FF9500', marginTop: 10, lineHeight: 1.5 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Blocker</div>
                {t.blockers}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Manager notes (visible to employee) ──────────────────────────────────────
function ManagerNotes({ comments }: { comments: Comment[] }) {
  if (!comments.length) return null
  return (
    <div style={{ marginTop: 12 }}>
      {comments.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(51,57,138,0.06)', borderRadius: 10, borderLeft: '3px solid #33398a', marginTop: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#33398a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'white', fontFamily: FONT }}>M</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#33398a', fontFamily: FONT, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manager note</div>
            <div style={{ fontSize: 13, color: '#1D1D1F', fontFamily: FONT, lineHeight: 1.5 }}>{c.text}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Step 1: Follow-up on open promises ────────────────────────────────────────
function FollowUpCard({ promises, projects, onResolve }: {
  promises: Commitment[]
  projects: Project[]
  onResolve: (id: string, action: 'done' | 'partial' | 'missed' | 'carry', note: string) => Promise<void>
}) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function act(id: string, action: 'done' | 'partial' | 'missed' | 'carry') {
    setBusy(id)
    try { await onResolve(id, action, notes[id] || '') } finally { setBusy(null) }
  }

  return (
    <div style={{ ...CARD, padding: '20px 24px', marginBottom: 16, border: '1px solid rgba(75,62,157,0.25)' }}>
      <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', marginBottom: 4 }}>
        Step 1 · Follow up on your commitments
      </div>
      <div style={{ fontSize: 13, color: '#6E6E73', marginBottom: 14 }}>
        Close these out before submitting today&apos;s update.
      </div>
      {promises.map(c => {
        const proj = projects.find(p => p.id === c.project_id)
        return (
          <div key={c.id} style={{ background: '#F5F5F7', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 700, background: c.horizon === 'week' ? 'rgba(75,62,157,0.12)' : 'rgba(51,57,138,0.1)', color: c.horizon === 'week' ? '#4b3e9d' : '#33398a' }}>
                {c.horizon === 'week' ? 'Weekly commitment' : 'Daily commitment'}
              </span>
              {projectPill(proj, c.project_id === '__other__')}
              {c.carry_count > 0 && (
                <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 700, background: 'rgba(255,149,0,0.12)', color: '#B25900' }}>
                  ⟳ carried ×{c.carry_count}
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, color: '#1D1D1F', lineHeight: 1.5, marginBottom: 10 }}>{c.text}</div>
            <input
              type="text"
              value={notes[c.id] || ''}
              onChange={e => setNotes(prev => ({ ...prev, [c.id]: e.target.value }))}
              placeholder="Optional note on the outcome…"
              style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: 'none', background: 'white', boxSizing: 'border-box', marginBottom: 8, boxShadow: 'none' }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['done', 'partial', 'missed'] as const).map(a => (
                <button key={a} disabled={busy === c.id} onClick={() => act(c.id, a)}
                  style={{ padding: '6px 14px', borderRadius: 980, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, border: `1.5px solid ${OUTCOME[a].color}50`, background: OUTCOME[a].color + '12', color: OUTCOME[a].color, opacity: busy === c.id ? 0.5 : 1 }}>
                  {OUTCOME[a].label}
                </button>
              ))}
              {c.horizon === 'day' && (
                <button disabled={busy === c.id} onClick={() => act(c.id, 'carry')}
                  style={{ padding: '6px 14px', borderRadius: 980, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, border: '1.5px solid rgba(0,0,0,0.12)', background: 'white', color: '#6E6E73', opacity: busy === c.id ? 0.5 : 1 }}>
                  Carry to next day →
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── My Stats tab ─────────────────────────────────────────────────────────────
function MyStats({ entries, projects, commitments }: { entries: Entry[]; projects: Project[]; commitments: Commitment[] }) {
  const myE = entries.filter(e => !e.is_absent).sort((a, b) => b.date.localeCompare(a.date))

  const resolved = commitments.filter(c => c.status !== 'open')
  const delivered = resolved.filter(c => c.status === 'done').length
  const reliability = resolved.length ? Math.round(delivered / resolved.length * 100) : null

  if (!myE.length && !commitments.length) return (
    <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 0 rgba(0,0,0,0.04),0 2px 16px rgba(0,0,0,0.05)', padding: '56px 20px', textAlign: 'center' }}>
      <div style={{ fontWeight: 600, fontSize: 16, color: '#AEAEB2', marginBottom: 4 }}>No data yet</div>
      <div style={{ fontSize: 13, color: '#AEAEB2' }}>Submit your first update to see stats.</div>
    </div>
  )
  const allTasks = myE.flatMap(e => e.project_tasks || [])
  const totalHours = allTasks.reduce((s, t) => s + (parseFloat(t.time) || 0), 0)
  const completionRate = allTasks.length ? Math.round(allTasks.filter(t => t.status === 'completed').length / allTasks.length * 100) : null
  const wlC = { heavy: myE.filter(e => e.workload === 'heavy').length, medium: myE.filter(e => e.workload === 'medium').length, light: myE.filter(e => e.workload === 'light').length }
  const projH: Record<string, number> = {}
  allTasks.forEach(t => { if (t.project_id) projH[t.project_id] = (projH[t.project_id] || 0) + (parseFloat(t.time) || 0) })
  const projBreak = Object.entries(projH).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxH = Math.max(...projBreak.map(([, h]) => h), 1)

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: '#1D1D1F', marginBottom: 20 }}>My Performance</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { v: reliability !== null ? reliability + '%' : '—', l: 'Commitment Reliability', c: '#4b3e9d' },
          { v: myE.length, l: 'Total Updates', c: '#33398a' },
          { v: completionRate !== null ? completionRate + '%' : '—', l: 'Completion Rate', c: '#34C759' },
          { v: totalHours > 0 ? totalHours.toFixed(1) + 'h' : '—', l: 'Hours Logged', c: '#6366F1' },
        ].map(s => (
          <div key={s.l} style={{ ...CARD, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.c, lineHeight: 1, marginBottom: 4 }}>{s.v}</div>
            <div style={{ fontSize: 13, color: '#6E6E73', fontWeight: 500 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Promise outcomes */}
      {resolved.length > 0 && (
        <div style={{ ...CARD, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, letterSpacing: '-0.02em' }}>Commitment Outcomes (last 30 days)</div>
          <div style={{ fontSize: 12, color: '#AEAEB2', marginBottom: 14 }}>Delivered ÷ committed — your headline accountability number.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(['done', 'partial', 'missed'] as const).map(k => {
              const count = resolved.filter(c => c.status === k).length
              return (
                <div key={k} style={{ flex: '1 0 calc(33% - 6px)', background: OUTCOME[k].color + '12', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: OUTCOME[k].color, letterSpacing: '-0.03em' }}>{count}</div>
                  <div style={{ fontSize: 11, color: OUTCOME[k].color, marginTop: 2, fontWeight: 600 }}>{OUTCOME[k].label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: '-0.02em' }}>Workload Distribution</div>
          {[{ l: 'Heavy', c: '#FF3B30', n: wlC.heavy }, { l: 'Medium', c: '#FF9500', n: wlC.medium }, { l: 'Light', c: '#34C759', n: wlC.light }].map(row => (
            <div key={row.l} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: row.c, display: 'inline-block' }} />{row.l}</span>
                <span style={{ fontWeight: 600, color: row.c }}>{row.n} <span style={{ color: '#AEAEB2', fontWeight: 400 }}>({myE.length ? Math.round(row.n / myE.length * 100) : 0}%)</span></span>
              </div>
              <div style={{ height: 5, background: '#F2F2F7', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${myE.length ? row.n / myE.length * 100 : 0}%`, background: row.c, borderRadius: 9999 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: '-0.02em' }}>Task Outcomes</div>
          {allTasks.length === 0
            ? <div style={{ color: '#AEAEB2', fontSize: 13, textAlign: 'center', paddingTop: 20 }}>No task data yet.</div>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(Object.entries(TASK_STATUS) as [TaskStatus, typeof TASK_STATUS[TaskStatus]][]).map(([key, s]) => {
                  const count = allTasks.filter(t => t.status === key).length
                  if (!count) return null
                  return (
                    <div key={key} style={{ flex: '1 0 calc(50% - 4px)', background: s.bg, borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.03em' }}>{count}</div>
                      <div style={{ fontSize: 11, color: s.color, marginTop: 2, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  )
                })}
              </div>
          }
        </div>
      </div>

      {projBreak.length > 0 && (
        <div style={{ ...CARD, padding: '20px 24px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Project Breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
            {projBreak.map(([pid, hrs]) => {
              const proj = projects.find(p => p.id === pid)
              const color = proj?.color || '#AEAEB2'
              const name = pid === '__other__' ? 'Other Work' : (proj?.name || pid)
              return (
                <div key={pid} style={{ padding: '6px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontWeight: 500, color: '#1D1D1F' }}>{name}</span>
                    </span>
                    <span style={{ color: '#6E6E73', fontWeight: 600 }}>{hrs > 0 ? hrs.toFixed(1) + 'h' : '—'}</span>
                  </div>
                  <div style={{ height: 4, background: '#F2F2F7', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(hrs / maxH) * 100}%`, background: color, borderRadius: 9999 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main EmployeePage ─────────────────────────────────────────────────────────
export default function EmployeePage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<'update' | 'stats'>('update')
  const [todayEntry, setTodayEntry] = useState<Entry | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [tasks, setTasks] = useState<LocalTask[]>([mkTask()])
  const [promises, setPromises] = useState<LocalPromise[]>([mkPromise()])
  const [weeklyPromise, setWeeklyPromise] = useState('')
  const [workload, setWorkload] = useState<Workload>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Bumped on every error so the toast re-mounts and re-flashes even when the
  // same message fires twice in a row (e.g. repeated failed submits).
  const [errorSeq, setErrorSeq] = useState(0)
  const [broadcast, setBroadcast] = useState<{ message: string; active: boolean } | null>(null)
  const [broadcastDismissed, setBroadcastDismissed] = useState(false)
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({})
  // A manager change that lands mid-edit is remembered here and applied on exit.
  const pendingRefresh = useRef(false)

  const showError = useCallback((msg: string) => {
    setError(msg)
    setErrorSeq(s => s + 1)
  }, [])

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const today = TODAY()
      const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const [eRes, pRes, bRes, hRes, cRes] = await Promise.all([
        fetch(`/api/entries?today=${today}&employee_id=${session.id}`),
        fetch('/api/projects'),
        fetch('/api/broadcast'),
        fetch(`/api/entries?employee_id=${session.id}&from=${from}&to=${today}`),
        fetch(`/api/commitments?from=${from}`),
      ])
      const [eData, pData, bData, hData, cData] = await Promise.all([eRes.json(), pRes.json(), bRes.json(), hRes.json(), cRes.json()])
      const todayEnt: Entry | null = eData.entries?.[0] || null
      const historyEnts: Entry[] = hData.entries || []
      setTodayEntry(todayEnt)
      setProjects(pData.projects || [])
      setBroadcast(bData.active ? bData : null)
      setEntries(historyEnts)
      setCommitments(cData.commitments || [])

      const allEntries = [...(todayEnt ? [todayEnt] : []), ...historyEnts]
      if (allEntries.length > 0) {
        const commentResults = await Promise.all(
          allEntries.map(e => fetch(`/api/comments?entry_id=${e.id}`).then(r => r.json()))
        )
        const map: Record<string, Comment[]> = {}
        allEntries.forEach((e, i) => { map[e.id] = commentResults[i].comments || [] })
        setCommentsMap(map)
      }
    } catch {
      showError('Failed to load data. Please refresh.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [session.id])

  useEffect(() => { fetchData() }, [fetchData])

  // Live updates: when the manager changes something affecting this employee
  // (a note, review, broadcast, marked absent…), silently re-fetch. While the
  // employee is mid-edit we never touch the screen — the change is remembered
  // and applied the moment they leave edit mode, so nothing is lost or clobbered.
  useNudge('manager_changed', payload => {
    if (payload.employeeId && payload.employeeId !== session.id) return
    if (editMode || submitting) { pendingRefresh.current = true; return }
    fetchData(true)
  })

  useEffect(() => {
    if (!editMode && !submitting && pendingRefresh.current) {
      pendingRefresh.current = false
      fetchData(true)
    }
  }, [editMode, submitting, fetchData])

  // Auto-dismiss the error toast so it doesn't linger after the user has read it.
  // Keyed on errorSeq too, so a repeated error restarts the countdown.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 6000)
    return () => clearTimeout(t)
  }, [error, errorSeq])

  function updateTask(i: number, field: keyof LocalTask, value: string | boolean) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }
  function toggleStatus(i: number) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, status: t.status === 'completed' ? 'in_progress' : 'completed' } : t))
  }
  function toggleBlockers(i: number) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, showBlockers: !t.showBlockers } : t))
  }
  function addTask() { setTasks(prev => [...prev, mkTask()]) }
  function removeTask(i: number) { setTasks(prev => prev.filter((_, idx) => idx !== i)) }

  async function attachFile(i: number, file: File) {
    updateTask(i, 'uploading', true)
    try {
      const att = await uploadAttachment(file)
      setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, attachments: [...(t.attachments || []), att] } : t))
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      updateTask(i, 'uploading', false)
    }
  }

  function toggleLink(i: number) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, showLink: !t.showLink, linkDraft: t.showLink ? '' : (t.linkDraft || '') } : t))
  }

  function commitLink(i: number) {
    setTasks(prev => prev.map((t, idx) => {
      if (idx !== i) return t
      const raw = (t.linkDraft || '').trim()
      if (!raw) return t
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      const att: Attachment = { type: 'link', url, name: url.replace(/^https?:\/\//i, '').slice(0, 60) }
      return { ...t, attachments: [...(t.attachments || []), att], linkDraft: '', showLink: false }
    }))
  }

  function removeAttachment(i: number, ai: number) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, attachments: (t.attachments || []).filter((_, j) => j !== ai) } : t))
  }

  async function resolvePromise(id: string, action: 'done' | 'partial' | 'missed' | 'carry', note: string) {
    const body = action === 'carry'
      ? { id, action: 'carry', outcome_note: note }
      : { id, status: action, outcome_note: note }
    const res = await fetch('/api/commitments', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })
    if (!res.ok) { const d = await res.json(); showError(d.error || 'Failed to update commitment.'); return }
    const d = await res.json()
    setCommitments(prev => prev.map(c => c.id === id ? d.commitment : c))
    sendNudge('employee_changed', { employeeId: session.id, kind: 'commitment' })
  }

  const today = TODAY()

  // Step 1 gate: open promises due today or earlier must be resolved first.
  const openFollowUps = commitments.filter(c => c.status === 'open' && c.due_date <= today)
  // Weekly promise needed if none exists for this week yet (first submission of the week).
  // On Saturday itself, a new weekly commitment targets NEXT week's Saturday —
  // otherwise it would be due the same day it was made.
  const thisWeekSat = dayOfWeek(today) === 6 ? weekSaturday(nextWorkingDay(today)) : weekSaturday(today)
  const needWeekly = !commitments.some(c => c.horizon === 'week' && c.due_date === thisWeekSat)
  const nextDay = nextWorkingDay(today)

  async function handleSubmit() {
    const validTasks = tasks.filter(t => t.task.trim())
    if (validTasks.length === 0) { showError('Add at least one task.'); return }
    if (validTasks.some(t => !(t.what_changed || '').trim())) {
      showError('Fill in "What changed since yesterday?" for every task.'); return
    }
    if (openFollowUps.length > 0) {
      showError('Close out your open commitments above before submitting.'); return
    }
    const validPromises = promises.filter(p => p.text.trim())
    if (!editMode && validPromises.length === 0) {
      showError("Add at least one commitment for tomorrow — what will you accomplish?"); return
    }
    if (!editMode && needWeekly && !weeklyPromise.trim()) {
      showError('This is your first update of the week — add your weekly commitment.'); return
    }

    setSubmitting(true); setError('')
    try {
      let entryId = todayEntry?.id
      if (editMode && todayEntry) {
        const res = await fetch('/api/entries', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: todayEntry.id, project_tasks: validTasks.map(toProjectTask), workload, submit_count: (todayEntry.submit_count || 1) + 1, is_absent: false })
        })
        if (!res.ok) { const d = await res.json(); showError(d.error || 'Update failed.'); return }
      } else {
        const res = await fetch('/api/entries', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: session.id, employee_name: session.name, date: today, workload, project_tasks: validTasks.map(toProjectTask) })
        })
        if (!res.ok) { const d = await res.json(); showError(d.error || 'Submission failed.'); return }
        const d = await res.json()
        entryId = d.entry?.id

        // Step 3: record tomorrow's (and the week's) promises.
        const rows: { text: string; horizon: string; due_date: string; project_id: string | null; created_in_entry_id: string | null }[] = validPromises.map(p => ({
          text: p.text, horizon: 'day', due_date: nextDay,
          project_id: p.project_id || null, created_in_entry_id: entryId ?? null,
        }))
        if (needWeekly && weeklyPromise.trim()) {
          rows.push({ text: weeklyPromise, horizon: 'week', due_date: thisWeekSat, project_id: null, created_in_entry_id: entryId ?? null })
        }
        if (rows.length > 0) {
          const cRes = await fetch('/api/commitments', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commitments: rows })
          })
          if (!cRes.ok) { const d2 = await cRes.json(); showError(d2.error || 'Saving commitments failed.'); return }
        }
      }
      setEditMode(false)
      setPromises([mkPromise()])
      setWeeklyPromise('')
      pendingRefresh.current = false
      await fetchData()
      // Nudge the manager's dashboard to refresh with this submission/edit.
      sendNudge('employee_changed', { employeeId: session.id, kind: 'entry' })
    } catch {
      showError('Connection error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit() {
    if (!todayEntry) return
    setTasks(todayEntry.project_tasks?.length ? todayEntry.project_tasks.map(toLocalTask) : [mkTask()])
    setWorkload(todayEntry.workload)
    setEditMode(true)
  }

  const hasSubmitted = !!todayEntry && !editMode
  const myProj = projects.filter(p => p.status === 'active' && (p.members?.includes(session.id) || p.lead === session.id))
  const otherProj = projects.filter(p => p.status === 'active' && !p.members?.includes(session.id) && p.lead !== session.id)
  const tomorrowsPromises = commitments.filter(c => c.status === 'open' && c.due_date > today)

  return (
    <div style={{ minHeight: '100vh', fontFamily: FONT }}>
      {/* Fixed error toast — always visible on submit, no scrolling needed */}
      {error && (
        <div key={errorSeq} className="toast-wrap" role="alert" aria-live="assertive">
          <div className="toast toast-error">
            <span className="toast-icon">!</span>
            <div className="toast-body">
              <div className="toast-title">Can&apos;t submit yet</div>
              <div className="toast-msg">{error}</div>
            </div>
            <button className="toast-close" onClick={() => setError('')} aria-label="Dismiss">×</button>
          </div>
        </div>
      )}

      {/* NavBar */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/meril-logo.svg" alt="Meril" style={{ height: 24, width: 'auto', display: 'block' }} />
          <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.12)' }} />
          <span className="navbar-title">Daily Tracker</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" style={{ background: 'rgba(51,57,138,0.1)', color: '#33398a', fontSize: 13 }}>
            {session.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>{session.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={onLogout}>Logout</button>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
        {/* Broadcast */}
        {!broadcastDismissed && broadcast?.active && broadcast.message && (
          <div className="broadcast-banner">
            <span className="broadcast-banner-icon">!</span>
            <div style={{ flex: 1 }}>
              <div className="broadcast-banner-label">Manager Announcement</div>
              <div className="broadcast-banner-text">{broadcast.message}</div>
            </div>
            <button onClick={() => setBroadcastDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', fontSize: 20, lineHeight: 1, flexShrink: 0, padding: '0 4px', fontFamily: FONT }}>×</button>
          </div>
        )}

        {/* iOS Segmented tab bar */}
        <div style={{ display: 'flex', gap: 6, background: '#F2F2F7', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
          {[['update', 'My Update'], ['stats', 'My Stats']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as 'update' | 'stats')}
              style={{ padding: '8px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', background: tab === id ? 'white' : 'transparent', color: tab === id ? '#1D1D1F' : '#6E6E73', fontWeight: tab === id ? 600 : 400, fontSize: 14, fontFamily: FONT, boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all .15s' }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}><div className="spinner" style={{ width: 28, height: 28, margin: '0 auto' }} /></div>
        ) : tab === 'stats' ? (
          <MyStats entries={entries} projects={projects} commitments={commitments} />
        ) : (
          /* ── MY UPDATE TAB ── */
          <div>
            {/* Step 1: follow-up on open promises */}
            {!hasSubmitted && openFollowUps.length > 0 && (
              <FollowUpCard promises={openFollowUps} projects={projects} onResolve={resolvePromise} />
            )}

            {/* Submitted state */}
            {hasSubmitted && (
              <div>
                {todayEntry.is_absent ? (
                  <div style={{ ...CARD, padding: '28px 24px', textAlign: 'center', marginBottom: 16, background: 'linear-gradient(135deg,#FFF9F0,#FFFBF6)', border: '1px solid rgba(255,149,0,0.25)' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,149,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 24 }}>🌙</div>
                    <h3 style={{ color: '#B25900', fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', marginBottom: 6 }}>
                      Marked absent today
                    </h3>
                    <p style={{ color: '#B25900', fontSize: 14 }}>
                      Your manager marked you absent for {FMT_DATE(today)}. If you actually worked, log your update below.
                    </p>
                    <button onClick={startEdit} style={{ marginTop: 16, padding: '8px 20px', background: 'white', border: '1.5px solid #FF9500', color: '#B25900', borderRadius: 980, fontSize: 14, fontWeight: 590, cursor: 'pointer', fontFamily: FONT }}>I worked today — log my update</button>
                  </div>
                ) : (
                  <>
                    <div style={{ ...CARD, padding: '28px 24px', textAlign: 'center', marginBottom: 16, background: 'linear-gradient(135deg,#F0FFF4,#F6FFFA)', border: '1px solid rgba(52,199,89,0.2)' }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(52,199,89,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 24 }}>✓</div>
                      <h3 style={{ color: '#1A6B31', fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', marginBottom: 6 }}>
                        Today&apos;s update submitted
                      </h3>
                      <p style={{ color: '#2D8A45', fontSize: 14 }}>
                        Submitted for {FMT_DATE(today)}. You can edit it until end of day.
                      </p>
                      <button onClick={startEdit} style={{ marginTop: 16, padding: '8px 20px', background: 'white', border: '1.5px solid #34C759', color: '#1A6B31', borderRadius: 980, fontSize: 14, fontWeight: 590, cursor: 'pointer', fontFamily: FONT }}>Edit Today&apos;s Update</button>
                    </div>
                    <TaskDisplay tasks={todayEntry.project_tasks} projects={projects} />
                  </>
                )}
                <ManagerNotes comments={commentsMap[todayEntry.id] || []} />

                {/* Promises made for tomorrow / this week */}
                {tomorrowsPromises.length > 0 && (
                  <div style={{ ...CARD, padding: '16px 20px', marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#4b3e9d', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Your open commitments</div>
                    {tomorrowsPromises.map(c => {
                      const proj = projects.find(p => p.id === c.project_id)
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 10, fontWeight: 700, background: c.horizon === 'week' ? 'rgba(75,62,157,0.12)' : 'rgba(51,57,138,0.1)', color: c.horizon === 'week' ? '#4b3e9d' : '#33398a', flexShrink: 0 }}>
                            {c.horizon === 'week' ? 'WEEK' : 'DAY'}
                          </span>
                          <span style={{ fontSize: 13, color: '#1D1D1F', flex: 1, minWidth: 150 }}>{c.text}</span>
                          {projectPill(proj, c.project_id === '__other__')}
                          <span style={{ fontSize: 11, color: '#AEAEB2' }}>due {FMT_DATE(c.due_date)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Form (new or edit) */}
            {(!hasSubmitted || editMode) && (
              <div style={{ ...CARD, padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', letterSpacing: '-0.02em' }}>
                  <div>
                    <span>{editMode ? "Update Today's Work" : `Step ${openFollowUps.length > 0 ? '2' : '1'} · Today's Work`}</span>
                    <div style={{ fontSize: 13, fontWeight: 400, color: '#AEAEB2', marginTop: 2 }}>{FMT_DATE(today)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 400, color: '#AEAEB2' }}>{myProj.length} project{myProj.length !== 1 ? 's' : ''}</span>
                    {editMode && <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(false)}>Cancel</button>}
                  </div>
                </div>

                {editMode && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14, background: 'rgba(51,57,138,0.06)', color: '#282d6e', border: '1px solid rgba(51,57,138,0.15)', fontWeight: 500 }}>
                    You can keep editing today&apos;s update until <strong>end of day</strong>, then it locks.
                  </div>
                )}

                {/* Task rows */}
                <div style={{ marginBottom: 8 }}>
                  {tasks.map((t, idx) => {
                    const proj = projects.find(p => p.id === t.project_id)
                    const si = TASK_STATUS[t.status] || TASK_STATUS.in_progress
                    return (
                      <div key={t.uid} style={{ background: 'white', borderRadius: 12, marginBottom: 8, border: `1px solid ${proj ? proj.color + '22' : 'rgba(0,0,0,0.07)'}`, borderLeft: `3px solid ${proj?.color || 'rgba(0,0,0,0.15)'}`, overflow: 'hidden' }}>
                        {/* Row 1: status circle • task title (primary) • hours • remove */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 12px 0' }}>
                          <div
                            onClick={() => toggleStatus(idx)}
                            title={t.status === 'completed' ? 'Completed — tap to reopen' : 'Tap to mark this task complete'}
                            style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${si.color}`, backgroundColor: t.status === 'in_progress' ? 'transparent' : si.color, flexShrink: 0, marginTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            {t.status === 'completed' && <span style={{ color: 'white', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                            {t.status === 'blocked' && <span style={{ color: 'white', fontSize: 12, fontWeight: 800, lineHeight: 1 }}>!</span>}
                            {t.status === 'in_progress' && <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: si.color }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <label style={LBL}>Task {idx + 1} · Title</label>
                            <input
                              type="text"
                              value={t.task}
                              onChange={e => updateTask(idx, 'task', e.target.value)}
                              placeholder="Short title — e.g. Fix casting latency"
                              style={{ width: '100%', border: '1px solid #e6e8f0', borderRadius: 8, fontSize: 15, fontWeight: 600, fontFamily: FONT, outline: 'none', background: 'white', color: '#0a1d20', padding: '9px 11px', boxSizing: 'border-box', boxShadow: 'none' }}
                            />
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            <label style={{ ...LBL, textAlign: 'center' }}>Hours</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={t.time}
                              onChange={e => {
                                const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
                                if (v === '' || v === '.' || (parseFloat(v) >= 0 && parseFloat(v) <= 24)) updateTask(idx, 'time', v)
                              }}
                              placeholder="0"
                              title="Hours spent (optional)"
                              style={{ width: 62, padding: '9px 6px', border: '1px solid #e6e8f0', borderRadius: 8, background: 'white', fontSize: 14, fontWeight: 600, outline: 'none', textAlign: 'center', color: '#2b3556', boxSizing: 'border-box', fontFamily: FONT, boxShadow: 'none' }}
                            />
                          </div>
                          {tasks.length > 1 && (
                            <button onClick={() => removeTask(idx)} title="Remove task" style={{ width: 24, height: 24, marginTop: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', padding: 0, lineHeight: 1, fontFamily: FONT, flexShrink: 0 }}>×</button>
                          )}
                        </div>

                        {/* Row 2: what changed since yesterday (required) */}
                        <div style={{ padding: '10px 12px 0 40px' }}>
                          <label style={LBL}>What changed since yesterday? <span style={{ color: '#e5484d' }}>*</span></label>
                          <textarea
                            value={t.what_changed || ''}
                            onChange={e => updateTask(idx, 'what_changed', e.target.value)}
                            placeholder="Progress, decisions, or results since your last update…"
                            rows={2}
                            style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(51,57,138,0.2)', borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: 'none', resize: 'none', background: 'rgba(51,57,138,0.03)', boxSizing: 'border-box', lineHeight: 1.5, color: '#0a1d20', boxShadow: 'none' }}
                          />
                        </div>

                        {/* Row 3: project pill • status pill • blocker toggle • attach */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px 10px 40px', flexWrap: 'wrap' }}>
                          <select
                            value={t.project_id}
                            onChange={e => updateTask(idx, 'project_id', e.target.value)}
                            style={{ width: 'auto', padding: '5px 22px 5px 10px', fontSize: 12, borderRadius: 980, border: `1px solid ${proj ? proj.color + '40' : 'rgba(0,0,0,0.12)'}`, backgroundColor: proj ? proj.color + '15' : '#F5F5F7', color: proj?.color || '#6E6E73', fontFamily: FONT, outline: 'none', fontWeight: 600, cursor: 'pointer', maxWidth: 160, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%236E6E73' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center', appearance: 'none', WebkitAppearance: 'none', boxShadow: 'none' }}
                          >
                            <option value="">— Project —</option>
                            {myProj.length > 0 && <optgroup label="My Projects">{myProj.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                            {otherProj.length > 0 && <optgroup label="Other Projects">{otherProj.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                            <optgroup label="General"><option value="__other__">Other Work</option></optgroup>
                          </select>

                          <select
                            value={t.status}
                            onChange={e => {
                              const s = e.target.value as TaskStatus
                              updateTask(idx, 'status', s)
                              if (s === 'blocked') setTasks(prev => prev.map((tk, i) => i === idx ? { ...tk, showBlockers: true } : tk))
                            }}
                            style={{ width: 'auto', padding: '5px 22px 5px 10px', fontSize: 12, borderRadius: 980, border: `1px solid ${si.color}40`, backgroundColor: `${si.color}15`, color: si.color, fontFamily: FONT, outline: 'none', fontWeight: 600, cursor: 'pointer', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%236E6E73' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center', appearance: 'none', WebkitAppearance: 'none', boxShadow: 'none' }}
                          >
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="blocked">Blocked</option>
                          </select>

                          <span style={{ width: 1, height: 18, background: '#e6e8f0', margin: '0 2px' }} />

                          <button
                            onClick={() => toggleBlockers(idx)}
                            style={t.showBlockers
                              ? { ...CHIP, borderColor: '#f5a623', backgroundColor: '#fdf3e2', color: '#a86a12' }
                              : CHIP}
                          >
                            <span style={{ fontSize: 13, lineHeight: 1 }}>⚑</span>
                            {t.showBlockers ? 'Blocker added' : 'Blocker'}
                          </button>

                          <label
                            style={t.uploading
                              ? { ...CHIP, color: '#33398a', borderColor: 'rgba(51,57,138,0.25)', opacity: 0.6 }
                              : { ...CHIP, color: '#33398a', borderColor: 'rgba(51,57,138,0.25)' }}
                          >
                            <span style={{ fontSize: 13, lineHeight: 1 }}>▣</span>
                            {t.uploading ? 'Uploading…' : 'Screenshot'}
                            <input
                              type="file"
                              accept="image/*,.pdf,.txt,.csv"
                              disabled={t.uploading}
                              onChange={e => { const f = e.target.files?.[0]; if (f) attachFile(idx, f); e.target.value = '' }}
                              style={{ display: 'none' }}
                            />
                          </label>

                          <button
                            onClick={() => toggleLink(idx)}
                            style={t.showLink
                              ? { ...CHIP, borderColor: '#33398a', backgroundColor: 'rgba(51,57,138,0.08)', color: '#282d6e' }
                              : { ...CHIP, color: '#33398a', borderColor: 'rgba(51,57,138,0.25)' }}
                          >
                            <span style={{ fontSize: 13, lineHeight: 1 }}>🔗</span>
                            Link
                          </button>
                        </div>

                        {/* Inline link input */}
                        {t.showLink && (
                          <div style={{ padding: '0 12px 10px 40px', display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              value={t.linkDraft || ''}
                              placeholder="Paste a link (e.g. github.com/…)"
                              autoFocus
                              onChange={e => updateTask(idx, 'linkDraft', e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitLink(idx) } }}
                              style={{ flex: 1, padding: '7px 10px', border: '1px solid rgba(51,57,138,0.25)', borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: 'none', background: 'white', boxSizing: 'border-box' }}
                            />
                            <button onClick={() => commitLink(idx)} disabled={!(t.linkDraft || '').trim()} style={{ padding: '7px 14px', background: '#33398a', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: (t.linkDraft || '').trim() ? 'pointer' : 'not-allowed', opacity: (t.linkDraft || '').trim() ? 1 : 0.5 }}>
                              Add
                            </button>
                          </div>
                        )}

                        {/* Attachments */}
                        {(t.attachments?.length || 0) > 0 && (
                          <div style={{ padding: '0 12px 10px 40px' }}>
                            <AttachmentChips attachments={t.attachments || []} onRemove={ai => removeAttachment(idx, ai)} />
                          </div>
                        )}

                        {/* Blocker textarea */}
                        {t.showBlockers && (
                          <div style={{ padding: '0 12px 12px 40px' }}>
                            <label style={{ ...LBL, color: '#B25900' }}>Blocker — what&apos;s stopping you?</label>
                            <textarea
                              value={t.blockers}
                              onChange={e => updateTask(idx, 'blockers', e.target.value)}
                              placeholder="Describe the blocker…"
                              rows={2}
                              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid rgba(255,149,0,0.35)', borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: 'none', resize: 'none', background: 'rgba(255,149,0,0.04)', boxSizing: 'border-box', lineHeight: 1.5, color: '#B25900', boxShadow: 'none' }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add task button (dashed) */}
                  <button onClick={addTask} style={{ width: '100%', padding: '11px 12px', background: 'none', border: '1.5px dashed rgba(51,57,138,0.3)', borderRadius: 10, color: '#33398a', fontSize: 14, cursor: 'pointer', fontFamily: FONT, fontWeight: 500, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    + Add task
                  </button>
                </div>

                {/* Step 3: Commit — promises for tomorrow (new submissions only) */}
                {!editMode && (
                  <div style={{ marginBottom: 20, background: 'rgba(75,62,157,0.04)', border: '1px solid rgba(75,62,157,0.18)', borderRadius: 12, padding: '16px 16px 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', marginBottom: 2, color: '#2b2f6b' }}>
                      Step {openFollowUps.length > 0 ? '3' : '2'} · Commit
                    </div>
                    <div style={{ fontSize: 12, color: '#6E6E73', marginBottom: 12 }}>
                      What will you accomplish by <strong>{FMT_DATE(nextDay)}</strong>? (followed up next working day)
                    </div>
                    {promises.map((p, idx) => {
                      const proj = projects.find(pr => pr.id === p.project_id)
                      return (
                        <div key={p.uid} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            value={p.text}
                            onChange={e => setPromises(prev => prev.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))}
                            placeholder={`Commitment ${idx + 1} — what will be done?`}
                            style={{ flex: 1, minWidth: 180, padding: '8px 10px', border: '1px solid rgba(75,62,157,0.25)', borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: 'none', background: 'white', boxSizing: 'border-box', boxShadow: 'none' }}
                          />
                          <select
                            value={p.project_id}
                            onChange={e => setPromises(prev => prev.map((x, i) => i === idx ? { ...x, project_id: e.target.value } : x))}
                            style={{ width: 'auto', padding: '6px 22px 6px 8px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', backgroundColor: proj ? proj.color + '12' : 'white', color: proj?.color || '#6E6E73', fontFamily: FONT, outline: 'none', fontWeight: 600, cursor: 'pointer', maxWidth: 140, appearance: 'none', WebkitAppearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%236E6E73' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 7px center', boxShadow: 'none' }}
                          >
                            <option value="">— Project —</option>
                            {myProj.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                            {otherProj.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                            <option value="__other__">Other Work</option>
                          </select>
                          {promises.length > 1 && (
                            <button onClick={() => setPromises(prev => prev.filter((_, i) => i !== idx))} style={{ width: 24, height: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', fontSize: 18, borderRadius: '50%', padding: 0, lineHeight: 1, fontFamily: FONT }}>×</button>
                          )}
                        </div>
                      )
                    })}
                    <button onClick={() => setPromises(prev => [...prev, mkPromise()])}
                      style={{ fontSize: 12, color: '#4b3e9d', background: 'none', border: '1px dashed rgba(75,62,157,0.4)', borderRadius: 7, cursor: 'pointer', padding: '5px 10px', fontFamily: FONT, marginBottom: needWeekly ? 12 : 4 }}>
                      + Add commitment
                    </button>

                    {needWeekly && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#4b3e9d', marginBottom: 6 }}>
                          First update this week — what will you accomplish by Saturday?
                        </div>
                        <textarea
                          value={weeklyPromise}
                          onChange={e => setWeeklyPromise(e.target.value)}
                          placeholder="Your commitment for this week (required)"
                          rows={2}
                          style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(75,62,157,0.3)', borderRadius: 8, fontSize: 13, fontFamily: FONT, outline: 'none', resize: 'none', background: 'white', boxSizing: 'border-box', lineHeight: 1.5, boxShadow: 'none' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Workload selector */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#6E6E73', marginBottom: 10, display: 'block', letterSpacing: '-0.01em' }}>Overall workload today</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['light', 'medium', 'heavy'] as Workload[]).map(w => {
                      const wl = WL[w]
                      const active = workload === w
                      return (
                        <button key={w} onClick={() => setWorkload(w)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${active ? wl.color : 'rgba(0,0,0,0.1)'}`, background: active ? wl.bg : 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, color: active ? wl.color : '#6E6E73', transition: 'all .15s', textAlign: 'center' }}>
                          {wl.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: '13px 22px', background: '#33398a', color: 'white', border: 'none', borderRadius: 980, fontSize: 17, fontWeight: 590, fontFamily: FONT, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, letterSpacing: '-0.01em', transition: 'opacity .12s' }}>
                  {submitting ? 'Submitting…' : editMode ? 'Save Changes' : "Submit Today's Update"}
                </button>
              </div>
            )}

            {/* Recent history */}
            {entries.filter(e => e.date !== today).slice(0, 5).length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Recent Updates</div>
                {entries.filter(e => e.date !== today).slice(0, 5).map(entry => (
                  <div key={entry.id} style={{ ...CARD, padding: '16px 20px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: '#AEAEB2' }}>{FMT_DATE(entry.date)}</div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 980, fontSize: 12, fontWeight: 600, background: WL[entry.workload].bg, color: WL[entry.workload].color }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: WL[entry.workload].color, flexShrink: 0, display: 'inline-block' }} />{WL[entry.workload].label}
                      </span>
                    </div>
                    {entry.is_absent
                      ? <div style={{ color: '#AEAEB2', fontSize: 13, fontStyle: 'italic' }}>Marked absent for this day.</div>
                      : <TaskDisplay tasks={entry.project_tasks} projects={projects} />
                    }
                    <ManagerNotes comments={commentsMap[entry.id] || []} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
