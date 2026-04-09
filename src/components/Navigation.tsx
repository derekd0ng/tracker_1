import { useRef, useState } from 'react';
import type { TabId } from '../types';
import { exportData, exportAsXlsx, importData } from '../storage';

interface Props {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

const NAV_ICONS: Record<TabId, React.ReactNode> = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 6V0H18V6H10V6M0 10V0H8V10H0V10M10 18V8H18V18H10V18M0 18V12H8V18H0V18M2 8H6V2H2V8V8M12 16H16V10H12V16V16M12 4H16V2H12V4V4M2 16H6V14H2V16V16M6 8V8V8V8V8V8M12 4V4V4V4V4V4M12 10V10V10V10V10V10M6 14V14V14V14V14V14" fill="currentColor"/>
    </svg>
  ),
  wellbeing: (
    <svg width="20" height="19" viewBox="0 0 20 19" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 18.35L8.55 17.05C6.86667 15.5333 5.475 14.225 4.375 13.125C3.275 12.025 2.4 11.0375 1.75 10.1625C1.1 9.2875 0.645833 8.48333 0.3875 7.75C0.129167 7.01667 0 6.26667 0 5.5C0 3.93333 0.525 2.625 1.575 1.575C2.625 0.525 3.93333 0 5.5 0C6.36667 0 7.19167 0.183333 7.975 0.55C8.75833 0.916667 9.43333 1.43333 10 2.1C10.5667 1.43333 11.2417 0.916667 12.025 0.55C12.8083 0.183333 13.6333 0 14.5 0C16.0667 0 17.375 0.525 18.425 1.575C19.475 2.625 20 3.93333 20 5.5C20 6.26667 19.8708 7.01667 19.6125 7.75C19.3542 8.48333 18.9 9.2875 18.25 10.1625C17.6 11.0375 16.725 12.025 15.625 13.125C14.525 14.225 13.1333 15.5333 11.45 17.05L10 18.35V18.35M10 15.65C11.6 14.2167 12.9167 12.9875 13.95 11.9625C14.9833 10.9375 15.8 10.0458 16.4 9.2875C17 8.52917 17.4167 7.85417 17.65 7.2625C17.8833 6.67083 18 6.08333 18 5.5C18 4.5 17.6667 3.66667 17 3C16.3333 2.33333 15.5 2 14.5 2C13.7167 2 12.9917 2.22083 12.325 2.6625C11.6583 3.10417 11.2 3.66667 10.95 4.35V4.35H9.05V4.35C8.8 3.66667 8.34167 3.10417 7.675 2.6625C7.00833 2.22083 6.28333 2 5.5 2C4.5 2 3.66667 2.33333 3 3C2.33333 3.66667 2 4.5 2 5.5C2 6.08333 2.11667 6.67083 2.35 7.2625C2.58333 7.85417 3 8.52917 3.6 9.2875C4.2 10.0458 5.01667 10.9375 6.05 11.9625C7.08333 12.9875 8.4 14.2167 10 15.65V15.65" fill="currentColor"/>
    </svg>
  ),
  medication: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 20C1.45 20 0.979167 19.8042 0.5875 19.4125C0.195833 19.0208 0 18.55 0 18V6C0 5.45 0.195833 4.97917 0.5875 4.5875C0.979167 4.19583 1.45 4 2 4H6V2C6 1.45 6.19583 0.979167 6.5875 0.5875C6.97917 0.195833 7.45 0 8 0H12C12.55 0 13.0208 0.195833 13.4125 0.5875C13.8042 0.979167 14 1.45 14 2V4H18C18.55 4 19.0208 4.19583 19.4125 4.5875C19.8042 4.97917 20 5.45 20 6V18C20 18.55 19.8042 19.0208 19.4125 19.4125C19.0208 19.8042 18.55 20 18 20H2V20M2 18H18V6H2V18M8 4H12V2H8V4M9 13V16H11V13H14V11H11V8H9V11H6V13H9Z" fill="currentColor"/>
    </svg>
  ),
  habits: (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.55 15.075L0 11.525L1.4 10.125L3.525 12.25L7.775 8L9.175 9.425L3.55 15.075V15.075M3.55 7.075L0 3.525L1.4 2.125L3.525 4.25L7.775 0L9.175 1.425L3.55 7.075V7.075M11 13.075V11.075H20V13.075H11V13.075M11 5.075V3.075H20V5.075H11V5.075" fill="currentColor"/>
    </svg>
  ),
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard',  label: 'Dashboard'  },
  { id: 'wellbeing',  label: 'Well-being' },
  { id: 'medication', label: 'Medications' },
  { id: 'habits',     label: 'Habits'     },
];

export default function Navigation({ activeTab, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(reader.result as string);
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
          {importStatus === 'ok' ? '✓ Imported' : importStatus === 'err' ? '✕ Invalid file' : '↑ Import backup'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
      </div>
    </aside>
  );
}
