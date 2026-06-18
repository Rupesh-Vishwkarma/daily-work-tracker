'use client'
import { useState } from 'react'
import { Session } from '@/lib/types'
import TodayTab from './manager/TodayTab'
import HistoryTab from './manager/HistoryTab'
import EmployeeTab from './manager/EmployeeTab'
import WorkloadTab from './manager/WorkloadTab'
import SettingsTab from './manager/SettingsTab'

type Tab = 'today' | 'history' | 'employee' | 'workload' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: '📅 Today' },
  { id: 'history', label: '📋 History' },
  { id: 'employee', label: '👤 By Employee' },
  { id: 'workload', label: '📊 Workload' },
  { id: 'settings', label: '⚙️ Settings' },
]

export default function ManagerPage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('today')

  return (
    <div>
      <nav style={{ background:'white', borderBottom:'1px solid #E2E8F0', padding:'.875rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.625rem', fontWeight:700, fontSize:'1.0625rem' }}>
          <div style={{ width:28, height:28, background:'#2563EB', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.9rem' }}>📋</div>
          Daily Tracker
          <span style={{ fontSize:'.75rem', background:'#EDE9FE', color:'#7C3AED', padding:'.15rem .6rem', borderRadius:'9999px', fontWeight:600, marginLeft:'.25rem' }}>Manager</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
          <div style={{ width:34, height:34, background:'#EDE9FE', color:'#7C3AED', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'.8125rem' }}>M</div>
          <button onClick={onLogout} style={{ padding:'.375rem .75rem', background:'#F1F5F9', color:'#475569', border:'1px solid #E2E8F0', borderRadius:'.5rem', fontSize:'.8125rem', cursor:'pointer' }}>Logout</button>
        </div>
      </nav>

      <div style={{ padding:'1.5rem', maxWidth:1200, margin:'0 auto' }}>
        <div style={{ display:'flex', gap:'.25rem', background:'#F1F5F9', padding:'.3rem', borderRadius:'.625rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding:'.5rem .9rem', borderRadius:'.4rem', fontSize:'.875rem', fontWeight:500, cursor:'pointer', border:'none', fontFamily:'inherit', whiteSpace:'nowrap', transition:'all .15s',
                background: tab === t.id ? 'white' : 'none',
                color: tab === t.id ? '#1E293B' : '#64748B',
                boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,.1)' : 'none'
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'today' && <TodayTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'employee' && <EmployeeTab />}
        {tab === 'workload' && <WorkloadTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
