import { useState, useEffect } from 'react';
import { api } from '../api';

interface Status {
  connected: boolean;
  connectedAt?: string;
}

interface LinkInfo {
  code: string;
  botUsername: string;
  expiresAt: string;
}

export default function TelegramConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Status>('/api/telegram/status')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<LinkInfo>('/api/telegram/link');
      setLinkInfo(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to generate link');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    try {
      await api.delete('/api/telegram/link');
      setStatus({ connected: false });
      setLinkInfo(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  }

  async function handleDone() {
    setLinkInfo(null);
    try {
      const data = await api.get<Status>('/api/telegram/status');
      setStatus(data);
    } catch {}
  }

  function handleCopy() {
    if (!linkInfo) return;
    navigator.clipboard.writeText(linkInfo.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (status === null) return null;

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {linkInfo ? (
        <div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.5 }}>
            {linkInfo.botUsername
              ? <>Open <a href={`https://t.me/${linkInfo.botUsername}?start=${linkInfo.code}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>@{linkInfo.botUsername}</a> and tap Start</>
              : 'Send this code to your bot:'
            }
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 6,
                padding: '6px 8px',
                userSelect: 'all',
                wordBreak: 'break-all',
                color: 'var(--text)',
                flex: 1,
              }}
            >
              {linkInfo.code}
            </div>
            <button
              onClick={handleCopy}
              title="Copy code"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: copied ? 'var(--accent)' : 'var(--text-muted)',
                padding: '4px',
                flexShrink: 0,
                transition: 'color 0.15s',
              }}
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
            </button>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            Expires in 15 min
          </p>
          <button className="sidebar-backup-btn" onClick={handleDone}>
            Done
          </button>
        </div>
      ) : status.connected ? (
        <div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            Telegram connected
          </p>
          <button className="sidebar-backup-btn" onClick={handleDisconnect} disabled={loading}>
            {loading ? 'Disconnecting…' : 'Disconnect Telegram'}
          </button>
        </div>
      ) : (
        <div>
          <button className="sidebar-backup-btn" onClick={handleConnect} disabled={loading}>
            {loading ? 'Generating…' : '⟳ Connect Telegram'}
          </button>
        </div>
      )}
      {error && <p style={{ fontSize: '0.68rem', color: 'var(--danger)', marginTop: 4 }}>{error}</p>}
    </div>
  );
}
