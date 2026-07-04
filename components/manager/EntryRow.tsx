'use client'
import React, { useState } from 'react'
import type { Entry, Project, Comment } from '@/lib/types'
import { FONT, CARD, fmtDate } from '@/lib/ui'

const WL = {
  heavy: { color: '#FF3B30', label: 'Heavy' },
  medium: { color: '#FF9500', label: 'Medium' },
  light: { color: '#34C759', label: 'Light' },
} as const

const TS = {
  in_progress: { color: '#0071E3', label: 'In Progress' },
  completed: { color: '#34C759', label: 'Done' },
  blocked: { color: '#FF3B30', label: 'Blocked' },
  carried: { color: '#FF9500', label: 'Carried →' },
} as const


interface EntryRowProps {
  entry: Entry
  showName?: boolean
  projects: Project[]
  isManager?: boolean
  comments?: Comment[]
  onAddComment?: (entryId: string, text: string) => Promise<void>
  onToggleReviewed?: (entryId: string) => void
  reviewed?: boolean
  onDelete?: (id: string) => void
  onExpand?: (entryId: string) => void
}

export default function EntryRow({
  entry, showName, projects, isManager, comments, onAddComment,
  onToggleReviewed, reviewed, onDelete, onExpand,
}: EntryRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [showCmt, setShowCmt] = useState(false)
  const [cmtText, setCmtText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const wl = WL[entry.workload] || WL.medium

  function toggleExpand() {
    if (entry.is_absent) return
    if (!expanded && onExpand) onExpand(entry.id)
    setExpanded(e => !e)
  }

  async function handleAddComment() {
    if (!cmtText.trim() || !onAddComment) return
    setSubmitting(true)
    try {
      await onAddComment(entry.id, cmtText)
      setCmtText(''); setShowCmt(false)
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ ...CARD, marginBottom: 12, overflow: 'hidden' }}>
      {entry.is_absent && (
        <div style={{ background: 'rgba(255,149,0,0.08)', borderBottom: '1px solid rgba(255,149,0,0.15)', padding: '5px 20px', fontSize: 12, color: '#B25900', fontWeight: 500, fontFamily: FONT }}>
          Marked absent by manager
        </div>
      )}
      {entry.submitted_by_manager && !entry.is_absent && (
        <div style={{ background: 'rgba(0,113,227,0.06)', borderBottom: '1px solid rgba(0,113,227,0.12)', padding: '5px 20px', fontSize: 12, color: '#0062C4', fontWeight: 500, fontFamily: FONT }}>
          Submitted by manager on behalf
        </div>
      )}

      <div
        style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: entry.is_absent ? 'default' : 'pointer' }}
        onClick={toggleExpand}
      >
        {showName && (
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#3C3C43', flexShrink: 0, fontFamily: FONT }}>
            {entry.employee_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {showName && (
            <div style={{ fontWeight: 600, fontSize: 15, color: '#1D1D1F', fontFamily: FONT, marginBottom: 2 }}>
              {entry.employee_name}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#6E6E73', fontFamily: FONT }}>{fmtDate(entry.date)}</span>
            {!entry.is_absent && (
              <>
                <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 600, background: wl.color + '18', color: wl.color, fontFamily: FONT }}>
                  {wl.label}
                </span>
                <span style={{ fontSize: 12, color: '#AEAEB2', fontFamily: FONT }}>
                  {entry.project_tasks?.length || 0} task{entry.project_tasks?.length !== 1 ? 's' : ''}
                </span>
                {entry.project_tasks?.some(t => t.status === 'blocked') && (
                  <span style={{ fontSize: 11, color: '#FF3B30', fontWeight: 600, fontFamily: FONT }}>⚠ blocker</span>
                )}
              </>
            )}
            {entry.is_absent && <span style={{ fontSize: 12, color: '#B25900', fontFamily: FONT }}>Absent</span>}
            {reviewed && <span style={{ fontSize: 11, color: '#34C759', fontWeight: 600, fontFamily: FONT }}>✓ Reviewed</span>}
          </div>
        </div>
        {isManager && onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(entry.id) }}
            style={{ width: 28, height: 28, background: '#F5F5F7', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 18, color: '#AEAEB2', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >×</button>
        )}
        {!entry.is_absent && (
          <span style={{ color: '#AEAEB2', fontSize: 14 }}>{expanded ? '▾' : '▸'}</span>
        )}
      </div>

      {expanded && !entry.is_absent && (
        <div style={{ padding: '0 20px 16px' }}>
          {(entry.project_tasks || []).map((task, i) => {
            const proj = projects.find(p => p.id === task.project_id)
            const ts = TS[task.status] || TS.in_progress
            return (
              <div key={i} style={{ background: '#F5F5F7', borderRadius: 10, padding: '10px 12px', marginBottom: 8, borderLeft: `3px solid ${proj?.color || '#AEAEB2'}` }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  {proj && (
                    <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 600, background: (proj.color || '#AEAEB2') + '20', color: proj.color || '#6E6E73', fontFamily: FONT }}>
                      {proj.name}
                    </span>
                  )}
                  <span style={{ padding: '2px 8px', borderRadius: 980, fontSize: 11, fontWeight: 600, background: ts.color + '15', color: ts.color, fontFamily: FONT }}>
                    {ts.label}
                  </span>
                  {task.time && <span style={{ fontSize: 11, color: '#AEAEB2', fontFamily: FONT }}>{task.time}</span>}
                </div>
                <div style={{ fontSize: 13, color: '#1D1D1F', lineHeight: 1.5, fontFamily: FONT }}>{task.task}</div>
                {task.what_changed && (
                  <div style={{ fontSize: 12, color: '#3C3C43', marginTop: 6, padding: '6px 10px', background: 'rgba(0,113,227,0.05)', borderRadius: 6, borderLeft: '2px solid rgba(0,113,227,0.35)', fontFamily: FONT, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, color: '#0071E3', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>What changed · </span>{task.what_changed}
                  </div>
                )}
                {(task.attachments?.length || 0) > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {(task.attachments || []).map((a, ai) => a.type === 'image' ? (
                      <a key={ai} href={a.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, display: 'block', border: '1px solid rgba(0,0,0,0.08)' }} />
                      </a>
                    ) : (
                      <a key={ai} href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#0071E3', textDecoration: 'none', background: 'white', borderRadius: 6, padding: '4px 8px', fontFamily: FONT, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.type === 'link' ? '🔗 ' : '📄 '}{a.name || a.url}
                      </a>
                    ))}
                  </div>
                )}
                {task.blockers && (
                  <div style={{ fontSize: 12, color: '#B25900', marginTop: 6, padding: '4px 8px', background: 'rgba(255,149,0,0.08)', borderRadius: 6, fontFamily: FONT }}>
                    Blocker: {task.blockers}
                  </div>
                )}
              </div>
            )
          })}

          {comments && comments.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {comments.map(c => (
                <div key={c.id} style={{ background: 'rgba(0,113,227,0.05)', border: '1px solid rgba(0,113,227,0.12)', borderRadius: 8, padding: '7px 12px', marginBottom: 6, fontSize: 13, color: '#1D1D1F', fontFamily: FONT }}>
                  <span style={{ fontWeight: 600, color: '#0062C4', fontSize: 11 }}>Manager note · </span>{c.text}
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {isManager && !entry.is_absent && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '10px 20px 14px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {onToggleReviewed && (
              <button onClick={() => onToggleReviewed(entry.id)}
                style={{ padding: '6px 14px', borderRadius: 980, fontSize: 12, fontWeight: 590, cursor: 'pointer', fontFamily: FONT, background: reviewed ? '#F5F5F7' : '#0071E3', color: reviewed ? '#6E6E73' : 'white', border: reviewed ? '1px solid rgba(0,0,0,0.1)' : 'none' }}>
                {reviewed ? '↩ Unmark Reviewed' : '✓ Mark Reviewed'}
              </button>
            )}
            {onAddComment && !showCmt && (
              <button onClick={() => setShowCmt(true)}
                style={{ padding: '6px 14px', borderRadius: 980, fontSize: 12, cursor: 'pointer', fontFamily: FONT, background: 'none', border: '1.5px solid rgba(0,113,227,0.3)', color: '#0071E3' }}>
                Add Note
              </button>
            )}
          </div>
          {showCmt && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={cmtText} onChange={e => setCmtText(e.target.value)}
                placeholder="Add a note or feedback…" rows={2}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid rgba(0,113,227,0.25)', borderRadius: 8, fontSize: 13, fontFamily: FONT, resize: 'none', boxSizing: 'border-box', outline: 'none', background: 'white' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={handleAddComment} disabled={submitting}
                  style={{ padding: '6px 14px', background: '#0071E3', color: 'white', border: 'none', borderRadius: 980, fontSize: 13, fontWeight: 590, cursor: 'pointer', fontFamily: FONT }}>
                  {submitting ? 'Adding…' : 'Add Note'}
                </button>
                <button onClick={() => { setShowCmt(false); setCmtText('') }}
                  style={{ padding: '6px 14px', background: 'none', border: '1.5px solid rgba(0,113,227,0.3)', color: '#0071E3', borderRadius: 980, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
