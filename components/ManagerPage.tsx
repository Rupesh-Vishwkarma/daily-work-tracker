'use client'
import { useState } from 'react'
import { Session } from '@/lib/types'
import TodayTab from './manager/TodayTab'
import BlockersTab from './manager/BlockersTab'
import ProjectsTab from './manager/ProjectsTab'
import HistoryTab from './manager/HistoryTab'
import SettingsTab from './manager/SettingsTab'

type Tab = 'today' | 'blockers' | 'projects' | 'history' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: '📅 Today' },
  { id: 'blockers', label: '🚫 Blockers' },
  { id: 'projects', label: '📁 Projects' },
  { id: 'history', label: '📋 History' },
  { id: 'settings', label: '⚙️ Settings' },
]

export default function ManagerPage({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('today')

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="navbar-logo">📋</div>
          <span className="navbar-title">Daily Tracker</span>
          <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--purple-bg)', color: 'var(--purple)', padding: '2px 8px', borderRadius: 'var(--r-pill)', letterSpacing: '0.04em' }}>MANAGER</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" style={{ background: 'var(--purple-bg)', color: 'var(--purple)', fontSize: 13, fontWeight: 700 }}>M</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{session.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={onLogout}>Logout</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
        <div className="tab-bar" style={{ marginBottom: 20, overflowX: 'auto', flexWrap: 'nowrap' }}>
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)} style={{ flex: 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'today' && <TodayTab />}
        {tab === 'blockers' && <BlockersTab />}
        {tab === 'projects' && <ProjectsTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
