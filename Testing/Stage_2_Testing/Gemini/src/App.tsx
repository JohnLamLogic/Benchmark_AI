import { useState } from 'react';
import { Calendar, Users, Menu } from 'lucide-react';
import EmployeesTab from './components/EmployeesTab';
import ScheduleTab from './components/ScheduleTab';

function App() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'employees'>('schedule');

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-lg">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
                  ShiftMaker
                </span>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <button
                  onClick={() => setActiveTab('schedule')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${activeTab === 'schedule'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule
                </button>
                <button
                  onClick={() => setActiveTab('employees')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${activeTab === 'employees'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Employees
                </button>
              </div>
            </div>
            {/* Mobile menu button could go here */}
            <div className="flex items-center sm:hidden">
              <button className="text-slate-500 hover:text-slate-700">
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {activeTab === 'schedule' ? <ScheduleTab /> : <EmployeesTab />}
      </main>
    </div>
  );
}

export default App;
