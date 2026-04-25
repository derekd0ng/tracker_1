import { useState, useEffect, useRef } from 'react';
import type { TabId } from '../types';
import TelegramConnect from './TelegramConnect';
import { exportData, exportAsXlsx, importData } from '../storage';

interface Props {
  onNavigate: (tab: TabId) => void;
  user?: { id: string; email: string; name?: string | null } | null;
  onLogout?: () => void;
}

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '255,255,255';
}

const NAV_TABS: { id: TabId; label: string; col: string }[] = [
  { id: 'home',       label: 'Home',        col: '#e2e2e2' },
  { id: 'wellbeing',  label: 'Well-being',  col: '#34d399' },
  { id: 'medication', label: 'Medications', col: '#22d3ee' },
  { id: 'habits',     label: 'Habits',      col: '#60a5fa' },
  { id: 'todo',       label: 'To-dos',      col: '#818cf8' },
  { id: 'diary',      label: 'Diary',       col: '#e879f9' },
];

function TabIcon({ id, size, color }: { id: string; size: number; color: string }) {
  const p = { width: size, height: size, stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  switch (id) {
    case 'home':       return <svg {...p} viewBox="0 0 16 16"><path d="M2 8.5L8 3L14 8.5V14H10.5V10H5.5V14H2V8.5Z"/></svg>;
    case 'wellbeing':  return <svg {...p} viewBox="0 0 16 16"><path d="M8 13S2.5 9.5 2.5 5.5a3.5 3.5 0 0 1 5.5-2.9 3.5 3.5 0 0 1 5.5 2.9C13.5 9.5 8 13 8 13z"/></svg>;
    case 'medication': return <svg {...p} viewBox="0 0 16 16"><rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><line x1="8" y1="6.5" x2="8" y2="10.5"/><line x1="6" y1="8.5" x2="10" y2="8.5"/></svg>;
    case 'habits':     return <svg {...p} viewBox="0 0 16 16"><polyline points="2,8 6,12 14,4"/></svg>;
    case 'todo':       return <svg {...p} viewBox="0 0 16 16"><line x1="5" y1="4" x2="14" y2="4"/><line x1="5" y1="8" x2="14" y2="8"/><line x1="5" y1="12" x2="14" y2="12"/><polyline points="2,3.5 3,4.5 4,2.5"/><polyline points="2,7.5 3,8.5 4,6.5"/></svg>;
    case 'diary':      return <svg {...p} viewBox="0 0 16 16"><rect x="3" y="1" width="10" height="13" rx="1.5"/><line x1="6" y1="5" x2="10" y2="5"/><line x1="6" y1="8" x2="10" y2="8"/><line x1="6" y1="11" x2="9" y2="11"/></svg>;
    default: return null;
  }
}

const BTN: React.CSSProperties = {
  width: 36, height: 36,
  background: 'transparent',
  border: '1px solid #2a2a2a',
  borderRadius: 4, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#e2e2e2', transition: 'all 0.15s',
};

export default function AppNav({ onNavigate, user, onLogout }: Props) {
  const navRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');

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
      {/* ── Top-left: nav button ── */}
      <div ref={navRef} style={{ position: 'fixed', top: 24, left: 24, zIndex: 350 }}>
        <button
          onClick={() => setNavOpen(o => !o)}
          style={{ ...BTN, background: navOpen ? '#1e1e1e' : 'transparent', borderColor: navOpen ? '#3a3a3a' : '#2a2a2a' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8.5L8 3L14 8.5V14H10.5V10H5.5V14H2V8.5Z"/>
          </svg>
        </button>
        {navOpen && (
          <div style={{ ...dropdownBase, top: 'calc(100% + 6px)', left: 0, minWidth: 153, display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
            {NAV_TABS.map(tab => (
              <button key={tab.id}
                onClick={() => { onNavigate(tab.id); setNavOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 14px',
                  background: 'transparent', border: 'none',
                  color: tab.col, fontSize: 13, fontWeight: 600,
                  fontFamily: 'Space Grotesk, sans-serif',
                  cursor: 'pointer', textAlign: 'left', letterSpacing: '0.01em',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <TabIcon id={tab.id} size={14} color={tab.col} />
                {tab.label}
              </button>
            ))}
          </div>
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
          style={{ ...BTN, background: settingsOpen ? '#1e1e1e' : 'transparent', borderColor: settingsOpen ? '#3a3a3a' : '#2a2a2a' }}
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
