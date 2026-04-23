import { useRef, useState } from 'react';
import type { TabId } from '../types';
import { exportData, exportAsXlsx, importData } from '../storage';
import TelegramConnect from './TelegramConnect';
import { IconDashboard, IconWellbeing, IconMedications, IconHabits, IconTodo } from './Icons';

interface Props {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  user?: { id: string; email: string } | null;
  onLogout?: () => void;
}

const NAV_ICONS: Record<TabId, React.ReactNode> = {
  dashboard:  <IconDashboard size={18} />,
  wellbeing:  <IconWellbeing size={18} />,
  medication: <IconMedications size={18} />,
  habits:     <IconHabits size={18} />,
  todo:       <IconTodo size={18} />,
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard',  label: 'Dashboard'  },
  { id: 'wellbeing',  label: 'Well-being' },
  { id: 'medication', label: 'Medications' },
  { id: 'habits',     label: 'Habits'     },
  { id: 'todo',       label: 'To-Do'      },
];

export default function Navigation({ activeTab, onChange, user, onLogout }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setImportStatus('loading');
      try {
        await importData(reader.result as string);
        setImportStatus('ok');
        setTimeout(() => window.location.reload(), 800);
      } catch {
        setImportStatus('err');
        setTimeout(() => setImportStatus('idle'), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <>
      {/* ── Sidebar (desktop) ── */}
      <aside className="sidebar" data-active={activeTab}>
        <div className="sidebar-logo">
          <h1 className="sidebar-logo-title">Recovery</h1>
          <p className="sidebar-logo-sub">Stay on track</p>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`sidebar-nav-item${isActive ? ' active' : ''}`}
                onClick={() => onChange(tab.id)}
              >
                <span className="sidebar-nav-icon">
                  {NAV_ICONS[tab.id]}
                </span>
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-backup">
          <button className="sidebar-backup-btn" onClick={exportData}>
            ↓ Export backup (JSON)
          </button>
          <button className="sidebar-backup-btn" onClick={() => exportAsXlsx()}>
            ↓ Export as Excel
          </button>
          <button className="sidebar-backup-btn" onClick={() => fileRef.current?.click()}>
            {importStatus === 'ok' ? '✓ Imported' : importStatus === 'err' ? '✕ Invalid file' : importStatus === 'loading' ? 'Importing…' : '↑ Import backup'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          {user && <TelegramConnect />}
          {user && onLogout && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </p>
              <button className="sidebar-backup-btn" onClick={onLogout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Bottom tab bar (mobile) ── */}
      <nav className="bottom-tabbar" data-active={activeTab}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`bottom-tab${isActive ? ' active' : ''}`}
              onClick={() => onChange(tab.id)}
            >
              <span className="bottom-tab-icon">{NAV_ICONS[tab.id]}</span>
              <span className="bottom-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
