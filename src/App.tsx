import { useState } from 'react';
import Navigation from './components/Navigation';
import DashboardTab from './components/dashboard/DashboardTab';
import WellbeingTab from './components/wellbeing/WellbeingTab';
import MedicationTab from './components/medication/MedicationTab';
import HabitsTab from './components/habits/HabitsTab';
import type { TabId } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="app">
      <Navigation activeTab={activeTab} onChange={setActiveTab} />
      <main className="app-main">
        <div className="content-center">
          {activeTab === 'dashboard' && <DashboardTab onNavigate={setActiveTab} />}
          {activeTab === 'wellbeing' && <div className="wb-theme"><WellbeingTab /></div>}
          {activeTab === 'medication' && <MedicationTab />}
          {activeTab === 'habits' && <div className="hab-theme"><HabitsTab /></div>}
        </div>
      </main>
    </div>
  );
}
