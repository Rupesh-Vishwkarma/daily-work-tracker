import { Entry } from '@/lib/types'

function fmtDate(str: string) {
  const d = new Date(str + 'T12:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(str: string) {
  const d = new Date(str)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function WorkloadBadge({ w }: { w: string }) {
  const cls = { heavy: 'badge-heavy', medium: 'badge-medium', light: 'badge-light' }[w] || 'badge-light'
  const icon = { heavy: '🔴', medium: '🟡', light: '🟢' }[w] || ''
  return <span className={`badge ${cls}`}>{icon} {w ? w.charAt(0).toUpperCase() + w.slice(1) : 'Unknown'}</span>
}

interface Props {
  entry: Entry
  showName?: boolean
  onDelete?: (id: string) => void
}

export default function EntryCard({ entry, showName, onDelete }: Props) {
  return (
    <div className={`entry-card ${entry.workload}`}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'.75rem', gap:'1rem', flexWrap:'wrap' }}>
        <div>
          {showName && <div style={{ fontWeight:600, color:'#1E293B', fontSize:'.9375rem' }}>{entry.employee_name}</div>}
          <div style={{ fontSize:'.8125rem', color:'#94A3B8' }}>📅 {fmtDate(entry.date)} &nbsp;·&nbsp; ⏱ {fmtDateTime(entry.timestamp)}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.5rem', flexShrink:0 }}>
          <WorkloadBadge w={entry.workload} />
          {onDelete && (
            <button onClick={() => { if (confirm('Permanently delete this entry?')) onDelete(entry.id) }}
              style={{ padding:'.25rem .6rem', background:'#EF4444', color:'white', border:'none', borderRadius:'.375rem', fontSize:'.75rem', cursor:'pointer', fontWeight:600 }}>
              🗑 Delete
            </button>
          )}
        </div>
      </div>
      <div style={{ color:'#374151', fontSize:'.9375rem', lineHeight:1.55, whiteSpace:'pre-wrap' }}>{entry.work}</div>
      {entry.blockers && (
        <div style={{ fontSize:'.875rem', color:'#92400E', background:'#FFFBEB', padding:'.5rem .75rem', borderRadius:'.375rem', borderLeft:'3px solid #F59E0B', marginTop:'.625rem', whiteSpace:'pre-wrap' }}>
          <div style={{ fontSize:'.75rem', fontWeight:600, color:'#D97706', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:'.2rem' }}>⚠ Blocker</div>
          {entry.blockers}
        </div>
      )}
    </div>
  )
}
