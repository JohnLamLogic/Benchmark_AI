"use client"

import { useState, useEffect, useContext } from 'react'
import { EmployeeContext } from '../layout'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function EmployeeSchedulePage() {
  const { currentEmployee } = useContext(EmployeeContext)
  const [shifts, setShifts] = useState<any[]>([])
  const [currentWeek, setCurrentWeek] = useState(() => {
    const d = new Date()
    const week = Math.ceil(d.getDate() / 7)
    return `${d.getFullYear()}-W${week}`
  })

  useEffect(() => {
    if (currentWeek && currentEmployee) fetchShifts()
  }, [currentWeek, currentEmployee])

  const fetchShifts = async () => {
    const res = await fetch(`/api/shifts?weekIdentifier=${currentWeek}`)
    const data = await res.json()
    // Filter for current employee
    setShifts(data.filter((s: any) => s.employeeId === currentEmployee.id))
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">My Schedule</h1>
          <p className="text-slate-500 mt-1">Hello, {currentEmployee?.name}</p>
        </div>
        
        <div className="flex gap-3">
          <input 
            type="week" 
            value={currentWeek} 
            onChange={e => setCurrentWeek(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm max-w-[160px] focus:ring-2 focus:ring-emerald-500" 
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-slate-100">
          {DAYS.map(day => {
            const dayIndexMap: Record<string, number> = {
              'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
            }
            const targetDay = dayIndexMap[day];
            const dayShifts = shifts.filter((s: any) => new Date(s.date).getDay() === targetDay);
            dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));

            return (
              <div key={day} className="flex p-6 items-center hover:bg-slate-50 transition-colors">
                <div className="w-48 font-semibold text-slate-700">{day}</div>
                <div className="flex-1 flex flex-wrap gap-3">
                  {dayShifts.length > 0 ? (
                    dayShifts.map((shift: any) => (
                      <div key={shift.id} className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 min-w-[140px]">
                        <div className="text-sm font-bold text-emerald-800 tracking-tight">
                          {shift.startTime} - {shift.endTime}
                        </div>
                        <div className="text-xs text-emerald-600 uppercase tracking-widest mt-1 font-medium">
                          {shift.position}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic text-sm py-3 border border-transparent">
                      Off
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
