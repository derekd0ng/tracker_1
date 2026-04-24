import { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import DashboardTab from './components/dashboard/DashboardTab';
import WellbeingTab from './components/wellbeing/WellbeingTab';
import MedicationTab from './components/medication/MedicationTab';
import HabitsTab from './components/habits/HabitsTab';
import TodoTab from './components/todo/TodoTab';
import DiaryTab from './components/diary/DiaryTab';
import AuthScreen from './components/auth/AuthScreen';
import { setAccessToken, AUTH_LOGOUT_EVENT, tryRefresh } from './api';
import { initStorage } from './storage';
import type { TabId } from './types';

type AuthState = 'checking' | 'unauthenticated' | 'loading' | 'ready';

interface User { id: string; email: string; name?: string | null; }

export default function App() {
  const [activeTab, setActiveTab]   = useState<TabId>('dashboard');
  const [authState, setAuthState]   = useState<AuthState>('checking');
  const [user, setUser]             = useState<User | null>(null);

  // On mount: restore session from localStorage token, fall back to refresh cookie
  useEffect(() => {
    async function restoreSession() {
      const { getAccessToken, api } = await import('./api');
      if (!getAccessToken()) {
        const ok = await tryRefresh();
        if (!ok) { setAuthState('unauthenticated'); return; }
      }
      // Token is now set — fetch user profile then boot storage
      try {
        const data = await api.get<{ user: User }>('/api/auth/me');
        setUser(data.user);
      } catch {
        setAuthState('unauthenticated');
        return;
      }
      await bootStorage();
    }
    restoreSession();

    // Listen for session expiry during use
    function onLogout() { setUser(null); setAuthState('unauthenticated'); }
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, []);

  async function bootStorage() {
    setAuthState('loading');
    try {
      await initStorage();
      setAuthState('ready');
    } catch (err) {
      console.error('Failed to load data:', err);
      setAuthState('unauthenticated');
    }
  }

  async function handleAuth(authedUser: User) {
    setUser(authedUser);
    await bootStorage();
  }

  function handleLogout() {
    setAccessToken(null);
    setUser(null);
    setAuthState('unauthenticated');
    import('./api').then(({ api }) => api.post('/api/auth/logout').catch(() => {}));
  }

  // ── Loading / checking ────────────────────────────────────────────────────
  if (authState === 'checking' || authState === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#080808', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(34,211,238,0.2)',
          borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {authState === 'loading' ? 'Loading your data…' : 'Checking session…'}
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return <AuthScreen onAuth={handleAuth} />;
  }

  // ── App ───────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <Navigation activeTab={activeTab} onChange={setActiveTab} user={user} onLogout={handleLogout} />
      <main className="app-main">
        <div className="content-center">
          {activeTab === 'dashboard'  && <DashboardTab onNavigate={setActiveTab} user={user} onUserUpdate={u => setUser(u)} />}
          {activeTab === 'wellbeing'  && <div className="wb-theme"><WellbeingTab /></div>}
          {activeTab === 'medication' && <MedicationTab />}
          {activeTab === 'habits'     && <div className="hab-theme"><HabitsTab /></div>}
          {activeTab === 'todo'       && <div className="todo-theme"><TodoTab /></div>}
          {activeTab === 'diary'      && <div className="diary-theme"><DiaryTab /></div>}
        </div>
      </main>
    </div>
  );
}
