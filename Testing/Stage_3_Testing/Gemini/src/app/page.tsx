"use client";

import { useState } from 'react';
import EmployeeManager from '@/components/EmployeeManager';
import ScheduleGrid from '@/components/ScheduleGrid';
import { Calendar, Users } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'employees'>('schedule');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-bold text-xl flex items-center gap-2 text-indigo-600">
            <Calendar className="text-indigo-600" />
            Restaurant Scheduler
          </div>
          <nav className="flex gap-2">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-2 rounded font-medium flex gap-2 items-center transition-colors ${activeTab === 'schedule' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <Calendar size={18} /> Schedule
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-4 py-2 rounded font-medium flex gap-2 items-center transition-colors ${activeTab === 'employees' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <Users size={18} /> Employees
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 overflow-auto">
        {activeTab === 'schedule' ? <ScheduleGrid /> : <EmployeeManager />}
      </main>
    </div>
  );
}
