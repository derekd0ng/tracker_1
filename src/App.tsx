import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import AppNav from './components/AppNav';
import DashboardTab from './components/dashboard/DashboardTab';
import WellbeingTab from './components/wellbeing/WellbeingTab';
import MedicationTab from './components/medication/MedicationTab';
import HabitsTab from './components/habits/HabitsTab';
import TodoTab from './components/todo/TodoTab';
import DiaryTab from './components/diary/DiaryTab';
import CalendarTab from './components/calendar/CalendarTab';
import HomeTab from './components/home/HomeTab';
import LabsTab from './components/labs/LabsTab';
import AuthScreen from './components/auth/AuthScreen';
import { setAccessToken, AUTH_LOGOUT_EVENT, tryRefresh } from './api';
import { initStorage } from './storage';
import type { TabId } from './types';
import { TAB_TO_PATH, pathToTab } from './routes';

type AuthState = 'checking' | 'unauthenticated' | 'loading' | 'ready';
interface User { id: string; email: string; name?: string | null; }

const Loader = ({ state }: { state: 'checking' | 'loading' }) => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d', flexDirection: 'column' }}>
    <style>{`@keyframes sq { 0%,60%,100%{opacity:0.1;transform:scaleY(0.5)}30%{opacity:1;transform:scaleY(1)} }`}</style>
    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'1.3rem', fontWeight:700, letterSpacing:'0.14em', color:'#e2e2e2', marginBottom:28 }}>/Octarine</span>
    <div style={{ display:'flex', gap:7, marginBottom:22 }}>
      {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, background:'#22d3ee', borderRadius:1, animation:`sq 1.4s ease-in-out ${i*0.22}s infinite` }} />)}
    </div>
    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:'0.14em', color:'#444', textTransform:'uppercase' }}>
      {state === 'loading' ? 'loading your data' : 'checking session'}
    </span>
  </div>
);

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [user, setUser]           = useState<User | null>(null);
  const navigate  = useNavigate();
  const location  = useLocation();

  const activeTab = pathToTab(location.pathname);
  const go = (tab: TabId) => navigate(TAB_TO_PATH[tab]);

  useEffect(() => {
    async function restoreSession() {
      const { getAccessToken, api } = await import('./api');
      if (!getAccessToken()) {
        const ok = await tryRefresh();
        if (!ok) { setAuthState('unauthenticated'); return; }
      }
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

    function onLogout() { setUser(null); setAuthState('unauthenticated'); }
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, []);

  async function bootStorage() {
    setAuthState('loading');
    try { await initStorage(); setAuthState('ready'); }
    catch { setAuthState('unauthenticated'); }
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

  if (authState === 'checking' || authState === 'loading') return <Loader state={authState} />;
  if (authState === 'unauthenticated') return <AuthScreen onAuth={handleAuth} />;

  const appNav = <AppNav user={user} onLogout={handleLogout} />;

  const bottomNav = (
    <nav className="bottom-tabbar" data-active={activeTab}>
      {(['home','dashboard','wellbeing','medication','habits','todo','diary','calendar','labs'] as TabId[]).map(id => (
        <button key={id} className={`bottom-tab${activeTab === id ? ' active' : ''}`} onClick={() => go(id)}>
          <span className="bottom-tab-label" style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{id}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <Routes>
      {/* Home — full-width canvas */}
      <Route path="/" element={
        <div className="app">
          {appNav}
          <main style={{ width: '100%', minHeight: '100vh', padding: '24px 24px 40px' }}>
            <HomeTab onNavigate={go} user={user} />
          </main>
          {bottomNav}
        </div>
      } />

      {/* Standard tabs */}
      <Route path="/*" element={
        <div className="app">
          {appNav}
          <main className="app-main">
            <div className="content-center">
              <Routes>
                <Route path="/dashboard"  element={<DashboardTab onNavigate={go} user={user} onUserUpdate={u => setUser(u)} />} />
                <Route path="/wellbeing"  element={<div className="wb-theme"><WellbeingTab /></div>} />
                <Route path="/meds"       element={<MedicationTab />} />
                <Route path="/habits"     element={<div className="hab-theme"><HabitsTab /></div>} />
                <Route path="/todos"      element={<div className="todo-theme"><TodoTab /></div>} />
                <Route path="/diary"      element={<div className="diary-theme"><DiaryTab /></div>} />
                <Route path="/calendar"  element={<CalendarTab />} />
                <Route path="/labs"       element={<LabsTab />} />
                <Route path="*"           element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
          {bottomNav}
        </div>
      } />
    </Routes>
  );
}
