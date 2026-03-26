"use client"

import { useState, useEffect } from 'react'

export default function TimeOffRequestsPage() {
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/time-off')
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (id: string, status: string, empId: string, date: string) => {
    setIsLoading(true)
    await fetch(`/api/time-off/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    
    // Trigger notification
    await fetch('/api/email/notify-time-off', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: empId, status, date })
    })
    
    fetchRequests()
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Time Off Requests</h1>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Employee</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Date Requested</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Reason</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No time off requests found.</td>
              </tr>
            )}
            {requests.map((req: any) => (
              <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">{req.employee?.name}</td>
                <td className="px-6 py-4 text-slate-600">{new Date(req.date).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={req.reason}>{req.reason}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    req.status === 'approved' ? 'bg-green-100 text-green-800' :
                    req.status === 'denied' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {req.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  {req.status === 'pending' && (
                    <>
                      <button onClick={() => handleUpdateStatus(req.id, 'approved', req.employeeId, req.date)} className="text-green-600 hover:text-green-800 text-sm font-medium transition-colors">
                        Approve
                      </button>
                      <button onClick={() => handleUpdateStatus(req.id, 'denied', req.employeeId, req.date)} className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors">
                        Deny
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
