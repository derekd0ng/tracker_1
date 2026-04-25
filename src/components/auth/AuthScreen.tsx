import { useState } from 'react';
import { api, setAccessToken } from '../../api';

interface Props {
  onAuth: (user: { id: string; email: string; name?: string | null }) => void;
}

type Mode = 'login' | 'register' | 'onboarding';

const ACCENT = '#22d3ee';

const field: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
};

const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#555', fontFamily: "'JetBrains Mono', monospace",
};

const input: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 4,
  color: '#e2e2e2', fontSize: 13, fontFamily: 'Space Grotesk, sans-serif',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

const submitBtn: React.CSSProperties = {
  width: '100%', padding: '11px 0', marginTop: 8,
  background: ACCENT, border: 'none', borderRadius: 4,
  color: '#080808', fontSize: 12, fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  fontFamily: "'JetBrains Mono', monospace",
  cursor: 'pointer', transition: 'opacity 0.15s',
};

const ghostBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0,
  color: ACCENT, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
  cursor: 'pointer', letterSpacing: '0.04em',
};

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0d0d0d', padding: 24,
    }}>
      {/* Subtle background gradient */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        width: '60vw', height: '60vw', borderRadius: '50%',
        background: `conic-gradient(from 0deg,
          rgba(52,211,153,0.10), rgba(34,211,238,0.12),
          rgba(96,165,250,0.08), rgba(34,211,238,0.10),
          rgba(52,211,153,0.10))`,
        filter: 'blur(80px)', transform: 'translate(-50%,-50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 380,
        background: '#111', borderRadius: 4,
        borderTop: `3px solid ${ACCENT}`,
        border: `1px solid #1e1e1e`,
        borderTopColor: ACCENT,
        padding: '32px 28px 28px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        {/* Brand */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.12em', color: '#e2e2e2', textTransform: 'uppercase' }}>
            /Octarine
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.14em', color: ACCENT, textTransform: 'uppercase', marginTop: 6 }}>
            {title}
          </div>
          <div style={{ width: '100%', height: 1, background: '#1e1e1e', marginTop: 18 }} />
        </div>

        {subtitle && (
          <div style={{ fontSize: 13, color: '#555', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 20 }}>
            {subtitle}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode]           = useState<Mode>('login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [pendingUser, setPendingUser] = useState<{ id: string; email: string } | null>(null);
  const [nameInput, setNameInput] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const data = await api.post(`/api/auth/${mode}`, { email: email.trim(), password });
      setAccessToken(data.accessToken);
      if (mode === 'register') { setPendingUser(data.user); setMode('onboarding'); }
      else onAuth(data.user);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingUser) return;
    const trimmed = nameInput.trim();
    if (trimmed) {
      try { onAuth((await api.patch('/api/auth/me', { name: trimmed })).user); }
      catch { onAuth({ ...pendingUser, name: null }); }
    } else {
      onAuth({ ...pendingUser, name: null });
    }
  }

  if (mode === 'onboarding') {
    return (
      <Card title="/welcome" subtitle="What should we call you?">
        <form onSubmit={handleNameSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={field}>
            <span style={label}>Your name</span>
            <input
              style={input} type="text" value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="e.g. Alex" autoFocus maxLength={60}
              onFocus={e => (e.target.style.borderColor = ACCENT)}
              onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
            />
          </div>
          <button type="submit" style={submitBtn}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {nameInput.trim() ? 'Continue' : 'Skip'}
          </button>
        </form>
      </Card>
    );
  }

  return (
    <Card
      title={mode === 'login' ? '/sign in' : '/create account'}
      subtitle=""
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={field}>
          <span style={label}>Email</span>
          <input
            style={input} type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" required autoFocus
            onFocus={e => (e.target.style.borderColor = ACCENT)}
            onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
          />
        </div>

        <div style={field}>
          <span style={label}>Password</span>
          <input
            style={input} type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'At least 8 characters' : ''}
            required
            onFocus={e => (e.target.style.borderColor = ACCENT)}
            onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
          />
        </div>

        {mode === 'register' && (
          <div style={field}>
            <span style={label}>Confirm password</span>
            <input
              style={input} type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your password" required
              onFocus={e => (e.target.style.borderColor = ACCENT)}
              onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
            />
          </div>
        )}

        {error && (
          <div style={{ fontSize: 11, color: '#f87171', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em' }}>
            ✕ {error}
          </div>
        )}

        <button type="submit" style={{ ...submitBtn, opacity: loading ? 0.6 : 1 }} disabled={loading}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = '1'; }}
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
        <span style={{ fontSize: 10, color: '#333', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>
          {mode === 'login' ? 'no account?' : 'have one?'}
        </span>
        <div style={{ flex: 1, height: 1, background: '#1e1e1e' }} />
      </div>

      <button
        style={{ ...ghostBtn, width: '100%', marginTop: 14, padding: '8px 0', textAlign: 'center' }}
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
        onMouseEnter={e => (e.currentTarget.style.color = '#67e8f9')}
        onMouseLeave={e => (e.currentTarget.style.color = ACCENT)}
      >
        {mode === 'login' ? '→ create account' : '→ sign in'}
      </button>
    </Card>
  );
}
