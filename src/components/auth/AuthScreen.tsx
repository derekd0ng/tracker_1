import { useState } from 'react';
import { api, setAccessToken } from '../../api';

interface Props {
  onAuth: (user: { id: string; email: string; name?: string | null }) => void;
}

type Mode = 'login' | 'register' | 'onboarding';

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode]       = useState<Mode>('login');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ id: string; email: string } | null>(null);
  const [nameInput, setNameInput]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'register' && password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post(`/api/auth/${mode}`, { email: email.trim(), password });
      setAccessToken(data.accessToken);
      if (mode === 'register') {
        setPendingUser(data.user);
        setMode('onboarding');
      } else {
        onAuth(data.user);
      }
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
      try {
        const data = await api.patch('/api/auth/me', { name: trimmed });
        onAuth(data.user);
      } catch {
        onAuth({ ...pendingUser, name: null });
      }
    } else {
      onAuth({ ...pendingUser, name: null });
    }
  }

  const cardStyle: React.CSSProperties = {
    width: '100%', maxWidth: 400,
    background: '#131b2e', borderRadius: 24,
    padding: '40px 36px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.06)',
  };

  // ── Onboarding: name step ─────────────────────────────────────────────────
  if (mode === 'onboarding') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1424', padding: 24 }}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>👋</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
              Welcome!
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 8 }}>
              What should we call you?
            </div>
          </div>
          <form onSubmit={handleNameSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-field">
              <label>Your name</label>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="e.g. Alex"
                autoFocus
                maxLength={60}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 4, height: 44, fontSize: '0.95rem' }}>
              {nameInput.trim() ? 'Continue' : 'Skip'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Login / Register ──────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0d1424', padding: 24,
    }}>
      <div style={cardStyle}>
        {/* Logo / title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
            Recovery
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : ''}
              required
            />
          </div>

          {mode === 'register' && (
            <div className="form-field">
              <label>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                required
              />
            </div>
          )}

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: 4, height: 44, fontSize: '0.95rem' }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button className="btn btn-ghost" style={{ padding: '0 4px', fontSize: '0.85rem', color: '#22D3EE' }}
                onClick={() => { setMode('register'); setError(''); }}>
                Sign up
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button className="btn btn-ghost" style={{ padding: '0 4px', fontSize: '0.85rem', color: '#22D3EE' }}
                onClick={() => { setMode('login'); setError(''); }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
