"use client"

import { useState, useEffect } from 'react'

export default function HoursTrackerPage() {
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [targetWeek, setTargetWeek] = useState(() => {
    const d = new Date()
    const week = Math.ceil(d.getDate() / 7)
    return `${d.getFullYear()}-W${week}`
  })

  useEffect(() => {
    fetchData()
  }, [targetWeek])

  const fetchData = async () => {
    const [empRes, shiftRes] = await Promise.all([
      fetch('/api/employees'),
      fetch(`/api/shifts?weekIdentifier=${targetWeek}`)
    ])
    setEmployees(await empRes.json())
    setShifts(await shiftRes.json())
  }

  const calculateHours = (empId: string) => {
    const empShifts = shifts.filter((s: any) => s.employeeId === empId)
    let totalHours = 0
    empShifts.forEach((s: any) => {
      const start = new Date(`1970-01-01T${s.startTime}:00`)
      const end = new Date(`1970-01-01T${s.endTime}:00`)
      let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      if (diff < 0) diff += 24 // overnight shift
      totalHours += diff
    })
    return totalHours
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Hours & Pay Tracker</h1>
          <p className="text-slate-500 mt-1">Review employee hours for the week</p>
        </div>
        <input 
          type="text" 
          value={targetWeek} 
          onChange={e => setTargetWeek(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" 
          placeholder="e.g., 2026-W12"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Employee</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Pay Rate</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Hours Worked</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Est. Pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No data available.</td>
              </tr>
            )}
            {employees.map((emp: any) => {
              const hours = calculateHours(emp.id)
              const pay = hours * emp.payRate
              return (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{emp.name}</td>
                  <td className="px-6 py-4 text-slate-600">${emp.payRate}/hr</td>
                  <td className="px-6 py-4 text-right font-medium text-blue-600">{hours.toFixed(2)} hrs</td>
                  <td className="px-6 py-4 text-right font-bold text-green-600">${pay.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
