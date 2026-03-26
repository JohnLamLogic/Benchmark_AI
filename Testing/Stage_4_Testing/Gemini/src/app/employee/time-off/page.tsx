"use client"

import { useState, useEffect, useContext } from 'react'
import { EmployeeContext } from '../layout'

export default function EmployeeTimeOffPage() {
  const { currentEmployee } = useContext(EmployeeContext)
  const [requests, setRequests] = useState([])
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (currentEmployee) fetchRequests()
  }, [currentEmployee])

  const fetchRequests = async () => {
    const res = await fetch('/api/time-off')
    const data = await res.json()
    setRequests(data.filter((r: any) => r.employeeId === currentEmployee.id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentEmployee) return
    
    await fetch('/api/time-off', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        reason,
        employeeId: currentEmployee.id
      })
    })
    
    setDate('')
    setReason('')
    fetchRequests()
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Time Off Requests</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Request Time Off</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="w-1/3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required 
                className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} required placeholder="e.g., Doctor appointment"
                className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors">
              Submit Request
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <h2 className="text-lg font-bold text-slate-800 p-6 border-b border-slate-200 bg-slate-50">My Requests</h2>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 text-sm font-semibold text-slate-600">
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Reason</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">No time off requests found.</td>
              </tr>
            )}
            {requests.map((req: any) => (
              <tr key={req.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-slate-800">{new Date(req.date).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-slate-600">{req.reason}</td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                    req.status === 'denied' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {req.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
