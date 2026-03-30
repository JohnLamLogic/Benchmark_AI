'use client';

import { useState } from 'react';
import ManagerDashboard from './components/ManagerDashboard';
import EmployeeDashboard from './components/EmployeeDashboard';

const tabs: { key: 'manager' | 'employee'; label: string }[] = [
  { key: 'manager', label: 'Manager Console' },
  { key: 'employee', label: 'Employee Hub' }
];

export default function Page() {
  const [activeTab, setActiveTab] = useState<'manager' | 'employee'>('manager');

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="site-header__content">
          <div>
            <p className="site-header__title">Shiftwise Scheduler</p>
            <p className="site-header__description">
              Build, archive, and send weekly restaurant schedules while tracking time-off requests.
            </p>
          </div>
          <nav className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`tab-button ${activeTab === tab.key ? 'tab-button--active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'manager' ? <ManagerDashboard /> : <EmployeeDashboard />}
      </main>
    </div>
  );
}
