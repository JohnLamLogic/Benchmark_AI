"use client"

import Link from 'next/link'
import { useState, useEffect, createContext } from 'react'

export const EmployeeContext = createContext<any>(null)

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState([])
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [currentEmployee, setCurrentEmployee] = useState<any>(null)

  useEffect(() => {
    fetch('/api/employees')
      .then(res => res.json())
      .then(data => {
        setEmployees(data)
        if (data.length > 0) {
          setSelectedEmpId(data[0].id)
          setCurrentEmployee(data[0])
        }
      })
  }, [])

  const handleSelect = (e: any) => {
    const id = e.target.value
    setSelectedEmpId(id)
    setCurrentEmployee(employees.find((emp: any) => emp.id === id))
  }

  return (
    <EmployeeContext.Provider value={{ currentEmployee, employees }}>
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-slate-800 border-r border-slate-700 text-white min-h-screen shadow-xl">
          <div className="p-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Employee Portal</h2>
          </div>
          
          <div className="px-4 mb-6">
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Mock Login As:</label>
            <select 
              value={selectedEmpId} 
              onChange={handleSelect}
              className="w-full bg-slate-700 border-slate-600 rounded px-2 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500"
            >
              <option disabled value="">Select Employee...</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <nav className="flex flex-col gap-2 px-4">
            <Link href="/employee/schedule" className="px-4 py-3 rounded hover:bg-slate-700 transition-colors">
              My Schedule
            </Link>
            <Link href="/employee/time-off" className="px-4 py-3 rounded hover:bg-slate-700 transition-colors">
              Time Off Requests
            </Link>
            <Link href="/employee/hours" className="px-4 py-3 rounded hover:bg-slate-700 transition-colors">
              My Hours & Pay
            </Link>
          </nav>
          
          <div className="p-6 mt-auto absolute bottom-0">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              &larr; Exit to Home
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto w-full">
          {!currentEmployee ? (
            <div className="flex items-center justify-center h-full text-slate-400">Loading profile...</div>
          ) : (
            children
          )}
        </main>
      </div>
    </EmployeeContext.Provider>
  )
}
