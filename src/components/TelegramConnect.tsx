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

  if (status === null) return null;

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {linkInfo ? (
        <div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.5 }}>
            Open Telegram and send this to{' '}
            {linkInfo.botUsername
              ? <a href={`https://t.me/${linkInfo.botUsername}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>@{linkInfo.botUsername}</a>
              : 'your bot'
            }:
          </p>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 6,
              padding: '6px 8px',
              userSelect: 'all',
              marginBottom: 6,
              wordBreak: 'break-all',
              color: 'var(--text)',
            }}
          >
            /start {linkInfo.code}
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
