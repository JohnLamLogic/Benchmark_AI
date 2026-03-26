"use client"

import { useState, useEffect } from 'react'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [payRate, setPayRate] = useState('')
  const [positions, setPositions] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees')
      const data = await res.json()
      setEmployees(Array.isArray(data) ? data : [])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    if (editingId) {
      await fetch(`/api/employees/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, payRate, positions })
      })
    } else {
      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, payRate, positions })
      })
    }
    setName('')
    setEmail('')
    setPayRate('')
    setPositions('')
    setEditingId(null)
    fetchEmployees()
  }

  const handleEdit = (emp: any) => {
    setName(emp.name)
    setEmail(emp.email)
    setPayRate(emp.payRate.toString())
    setPositions(emp.positions)
    setEditingId(emp.id)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return
    setIsLoading(true)
    await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    fetchEmployees()
  }

  const handleCancelEdit = () => {
    setName('')
    setEmail('')
    setPayRate('')
    setPositions('')
    setEditingId(null)
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Manage Employees</h1>
      
      {/* Add/Edit Employee Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4">{editingId ? 'Edit Employee' : 'Add New Employee'}</h2>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input required type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <input required type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <input required type="number" step="0.01" placeholder="Pay Rate" value={payRate} onChange={e => setPayRate(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <input required type="text" placeholder="Positions (e.g., Host, Server)" value={positions} onChange={e => setPositions(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          
          <div className="col-span-full flex justify-end gap-3">
            {editingId && (
              <button type="button" onClick={handleCancelEdit} disabled={isLoading} className="text-slate-600 px-6 py-2 rounded-lg font-medium hover:bg-slate-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
            )}
            <button disabled={isLoading} type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {isLoading ? 'Processing...' : (editingId ? 'Update Employee' : 'Add Employee')}
            </button>
          </div>
        </form>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Name</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Email</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Pay Rate</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Positions</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No employees found. Add one above!</td>
              </tr>
            )}
            {employees.map((emp: any) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">{emp.name}</td>
                <td className="px-6 py-4 text-slate-600">{emp.email}</td>
                <td className="px-6 py-4 text-slate-600">${emp.payRate}/hr</td>
                <td className="px-6 py-4 text-slate-600">{emp.positions}</td>
                <td className="px-6 py-4 text-right space-x-4">
                  <button onClick={() => handleEdit(emp)} className="text-blue-500 hover:text-blue-700 text-sm font-medium transition-colors">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(emp.id)} className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
