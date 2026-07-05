'use client'
import { useState } from 'react'
import { Session } from '@/lib/types'
import { FONT } from '@/lib/ui'
import TodayTab from './manager/TodayTab'
import CommitmentsTab from './manager/CommitmentsTab'
import BlockersTab from './manager/BlockersTab'
import ProjectsTab from './manager/ProjectsTab'
import HistoryTab from './manager/HistoryTab'
import SettingsTab from './manager/SettingsTab'

type Tab = 'today' | 'commitments' | 'blockers' | 'projects' | 'history' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'commitments', label: 'Commitments' },
  { id: 'blockers', label: 'Blockers' },
  { id: 'projects', label: 'Projects' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
]

export default function ManagerPage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('today')

  return (
    <div style={{ minHeight: '100vh', background: '#f6f7fb', fontFamily: FONT }}>
      {/* Nav */}
      <nav style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/meril-logo.svg" alt="Meril" style={{ height: 22, width: 'auto', display: 'block' }} />
            <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.12)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', fontFamily: FONT, letterSpacing: '-0.01em' }}>Daily Tracker</span>
            <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(75,62,157,0.12)', color: '#4b3e9d', padding: '2px 8px', borderRadius: 980, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: FONT }}>MANAGER</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', fontFamily: FONT }}>{session.name}</span>
            <button onClick={onLogout}
              style={{ padding: '5px 14px', background: 'none', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 980, fontSize: 13, cursor: 'pointer', color: '#6E6E73', fontFamily: FONT, fontWeight: 500 }}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
        {/* Tab bar — iOS segmented control */}
        <div style={{ display: 'flex', gap: 6, background: '#E5E5EA', borderRadius: 12, padding: 4, marginBottom: 20, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 'none', padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? '#1D1D1F' : '#6E6E73', background: tab === t.id ? 'white' : 'transparent', boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'today' && <TodayTab managerSession={session} />}
        {tab === 'commitments' && <CommitmentsTab />}
        {tab === 'blockers' && <BlockersTab />}
        {tab === 'projects' && <ProjectsTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
