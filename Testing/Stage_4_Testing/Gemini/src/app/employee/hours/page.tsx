"use client"

import { useState, useEffect, useContext } from 'react'
import { EmployeeContext } from '../layout'

export default function EmployeeHoursPage() {
  const { currentEmployee } = useContext(EmployeeContext)
  const [shifts, setShifts] = useState([])
  const [targetWeek, setTargetWeek] = useState(() => {
    const d = new Date()
    const week = Math.ceil(d.getDate() / 7)
    return `${d.getFullYear()}-W${week}`
  })

  useEffect(() => {
    if (currentEmployee) fetchData()
  }, [targetWeek, currentEmployee])

  const fetchData = async () => {
    const res = await fetch(`/api/shifts?weekIdentifier=${targetWeek}`)
    const data = await res.json()
    setShifts(data.filter((s: any) => s.employeeId === currentEmployee.id))
  }

  const calculateHours = () => {
    let totalHours = 0
    shifts.forEach((s: any) => {
      const start = new Date(`1970-01-01T${s.startTime}:00`)
      const end = new Date(`1970-01-01T${s.endTime}:00`)
      let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      if (diff < 0) diff += 24 // overnight shift
      totalHours += diff
    })
    return totalHours
  }

  const totalHours = calculateHours()
  const estimatedPay = currentEmployee ? totalHours * currentEmployee.payRate : 0

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">My Hours & Pay</h1>
          <p className="text-slate-500 mt-1">Review your worked hours</p>
        </div>
        <input 
          type="week" 
          value={targetWeek} 
          onChange={e => setTargetWeek(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm max-w-[160px] focus:ring-2 focus:ring-emerald-500" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Pay Rate</p>
            <p className="text-2xl font-bold text-slate-800">${currentEmployee?.payRate?.toFixed(2)}/hr</p>
          </div>
          <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xl">$</div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Hours this block</p>
            <p className="text-2xl font-bold text-emerald-600">{totalHours.toFixed(2)}</p>
          </div>
          <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-bold text-xl">H</div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Estimated Pay</p>
            <p className="text-2xl font-bold text-green-600">${estimatedPay.toFixed(2)}</p>
          </div>
          <div className="h-12 w-12 bg-green-50 rounded-full flex items-center justify-center text-green-600 font-bold text-xl">$</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-8">
        <h2 className="text-lg font-bold text-slate-800 p-6 border-b border-slate-200 bg-slate-50">Shift Breakdown</h2>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 text-sm font-semibold text-slate-600">
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Position</th>
              <th className="px-6 py-4 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shifts.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">No shifts scheduled for this week.</td>
              </tr>
            )}
            {shifts.map((s: any) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-800">{new Date(s.date).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-slate-600 uppercase text-xs tracking-wider">{s.position}</td>
                <td className="px-6 py-4 text-right text-slate-600 font-medium">
                  {s.startTime} - {s.endTime}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
