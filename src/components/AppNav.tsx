import { useState, useEffect, useRef } from 'react';
import type { TabId } from '../types';
import TelegramConnect from './TelegramConnect';
import { exportData, exportAsXlsx, importData } from '../storage';
import {
  IconHome, IconDashboard, IconWellbeing, IconMedications,
  IconHabits, IconTodo, IconDiary,
} from './Icons';

interface Props {
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  user?: { id: string; email: string; name?: string | null } | null;
  onLogout?: () => void;
}

const TAB_ACCENT: Record<string, string> = {
  home:       '#e2e2e2',
  dashboard:  '#f97316',
  wellbeing:  '#34d399',
  medication: '#22d3ee',
  habits:     '#60a5fa',
  todo:       '#818cf8',
  diary:      '#e879f9',
};

function ActiveIcon({ id, color }: { id: string; color: string }) {
  const s = { size: 16, color };
  switch (id) {
    case 'home':       return <IconHome {...s} />;
    case 'dashboard':  return <IconDashboard {...s} />;
    case 'wellbeing':  return <IconWellbeing {...s} />;
    case 'medication': return <IconMedications {...s} />;
    case 'habits':     return <IconHabits {...s} />;
    case 'todo':       return <IconTodo {...s} />;
    case 'diary':      return <IconDiary {...s} />;
    default:           return <IconHome {...s} />;
  }
}

function TabIcon({ id, color }: { id: string; color: string }) {
  return <ActiveIcon id={id} color={color} />;
}

const NAV_TABS: { id: TabId; label: string }[] = [
  { id: 'home',       label: 'Home'        },
  { id: 'wellbeing',  label: 'Well-being'  },
  { id: 'medication', label: 'Medications' },
  { id: 'habits',     label: 'Habits'      },
  { id: 'todo',       label: 'To-dos'      },
  { id: 'diary',      label: 'Diary'       },
];

export default function AppNav({ activeTab, onNavigate, user, onLogout }: Props) {
  const navRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');

  const accent = TAB_ACCENT[activeTab] ?? '#e2e2e2';

  useEffect(() => {
    if (!navOpen) return;
    function onDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setNavOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [navOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onDown(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [settingsOpen]);

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
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

  const dropdownBase: React.CSSProperties = {
    position: 'absolute',
    background: '#0f0f0f', border: '1px solid #2a2a2a',
    borderRadius: 6, zIndex: 400,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  };

  return (
    <>
      {/* ── Top-left: nav button + optional OCTARINE label ── */}
      <div style={{ position: 'fixed', top: 24, left: 24, zIndex: 350, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div ref={navRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setNavOpen(o => !o)}
            style={{
              width: 36, height: 36,
              background: navOpen ? '#1e1e1e' : 'transparent',
              border: `1px solid ${navOpen ? accent : accent + '66'}`,
              borderRadius: 4, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: accent, transition: 'all 0.15s',
            }}
          >
            <ActiveIcon id={activeTab} color={accent} />
          </button>
          {navOpen && (
            <div style={{ ...dropdownBase, top: 'calc(100% + 6px)', left: 0, minWidth: 153, display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
              {NAV_TABS.map(tab => {
                const col = TAB_ACCENT[tab.id];
                return (
                  <button key={tab.id}
                    onClick={() => { onNavigate(tab.id); setNavOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '9px 14px',
                      background: 'transparent', border: 'none',
                      color: col, fontSize: 13, fontWeight: 600,
                      fontFamily: 'Space Grotesk, sans-serif',
                      cursor: 'pointer', textAlign: 'left', letterSpacing: '0.01em',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <TabIcon id={tab.id} color={col} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* OCTARINE brand — only on home tab */}
        {activeTab === 'home' && (
          <span style={{
            fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.12em',
            color: '#e2e2e2', fontFamily: "'JetBrains Mono', monospace",
            textTransform: 'uppercase', userSelect: 'none',
          }}>
            Octarine
          </span>
        )}
      </div>

      {/* ── Bottom-left: settings button ── */}
      <div ref={settingsRef} style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 350 }}>
        {settingsOpen && (
          <div style={{ ...dropdownBase, bottom: 'calc(100% + 8px)', left: 0, minWidth: 210, display: 'flex', flexDirection: 'column', padding: '6px 0' }}>
            {([
              { label: '↓ Export backup (JSON)', action: () => { exportData(); setSettingsOpen(false); } },
              { label: '↓ Export as Excel',       action: () => { exportAsXlsx(); setSettingsOpen(false); } },
              { label: importStatus === 'ok' ? '✓ Imported' : importStatus === 'err' ? '✕ Invalid file' : importStatus === 'loading' ? 'Importing…' : '↑ Import backup',
                action: () => importFileRef.current?.click() },
            ]).map((item, i) => (
              <button key={i} onClick={item.action} style={{
                display: 'flex', alignItems: 'center',
                width: '100%', padding: '9px 14px',
                background: 'transparent', border: 'none',
                color: '#e2e2e2', fontSize: 12, fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer', textAlign: 'left',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >{item.label}</button>
            ))}
            <input ref={importFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            {user && (
              <div style={{ padding: '4px 14px 2px', borderTop: '1px solid #1e1e1e', marginTop: 4 }}>
                <TelegramConnect />
              </div>
            )}
            {user && onLogout && (
              <div style={{ borderTop: '1px solid #1e1e1e', marginTop: 4, padding: '6px 14px 4px' }}>
                <p style={{ fontSize: '0.72rem', color: '#555', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>
                  {user.email}
                </p>
                <button onClick={() => { onLogout(); setSettingsOpen(false); }} style={{
                  display: 'flex', alignItems: 'center', width: '100%', padding: '7px 0',
                  background: 'transparent', border: 'none',
                  color: '#f87171', fontSize: 12, fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer', textAlign: 'left',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fca5a5')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#f87171')}
                >Sign out</button>
              </div>
            )}
          </div>
        )}
        <button
          onClick={() => setSettingsOpen(o => !o)}
          style={{
            width: 36, height: 36,
            background: settingsOpen ? '#1e1e1e' : 'transparent',
            border: `1px solid ${settingsOpen ? '#3a3a3a' : '#2a2a2a'}`,
            borderRadius: 4, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#e2e2e2', transition: 'all 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5.5 3.7L6.3 1.7H9.7L10.5 3.7L12.6 3.4L14.3 6.3L13 8L14.3 9.7L12.6 12.6L10.5 12.3L9.7 14.3H6.3L5.5 12.3L3.4 12.6L1.7 9.7L3 8L1.7 6.3L3.4 3.4Z"/>
            <circle cx="8" cy="8" r="2.5"/>
          </svg>
        </button>
      </div>
    </>
  );
}
