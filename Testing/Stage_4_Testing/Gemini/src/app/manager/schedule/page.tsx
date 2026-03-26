"use client"

import { useState, useEffect } from 'react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function SchedulePage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [currentWeek, setCurrentWeek] = useState(() => {
    const d = new Date()
    // Simple week identifier string e.g., 2026-W12
    const week = Math.ceil(d.getDate() / 7)
    return `${d.getFullYear()}-W${week}`
  })
  
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [isEmailLoading, setIsEmailLoading] = useState(false)

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templates, setTemplates] = useState<string[]>([])

  // Shift Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  
  // Shift Form State
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [position, setPosition] = useState('')
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null)

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (currentWeek) fetchShifts()
  }, [currentWeek])

  const fetchEmployees = async () => {
    const res = await fetch('/api/employees')
    const data = await res.json()
    setEmployees(Array.isArray(data) ? data : [])
  }

  const fetchShifts = async () => {
    const res = await fetch(`/api/shifts?weekIdentifier=${currentWeek}`)
    const data = await res.json()
    setShifts(Array.isArray(data) ? data : [])
  }

  const openModal = (emp: any, day: string, existingShift?: any) => {
    setSelectedEmployee(emp)
    setSelectedDay(day)
    if (existingShift) {
      setStartTime(existingShift.startTime)
      setEndTime(existingShift.endTime)
      setPosition(existingShift.position)
      setEditingShiftId(existingShift.id)
    } else {
      setStartTime('09:00')
      setEndTime('17:00')
      setPosition(emp.positions.split(',')[0] || '')
      setEditingShiftId(null)
    }
    setIsModalOpen(true)
  }

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsModalOpen(false)
    
    const dayIndexMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
    }
    const dayIndex = dayIndexMap[selectedDay] ?? 1
    // 2024-01-07 is a Sunday. 7 + dayIndex ensures getDay() matches perfectly
    const shiftDate = new Date(2024, 0, 7 + dayIndex)
    
    if (editingShiftId) {
      await fetch(`/api/shifts/${editingShiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime, endTime, position })
      })
    } else {
      await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: shiftDate,
          startTime,
          endTime,
          position,
          weekIdentifier: currentWeek,
          employeeId: selectedEmployee.id
        })
      })
    }
    fetchShifts()
  }

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Delete this shift?')) return
    setIsModalOpen(false)
    await fetch(`/api/shifts/${shiftId}`, { method: 'DELETE' })
    fetchShifts()
  }

  const handlePreload = async () => {
    const prevWeekNumber = parseInt(currentWeek.split('-W')[1]) - 1
    const prevWeek = currentWeek.split('-W')[0] + '-W' + prevWeekNumber
    
    // Fetch prev week shifts
    const res = await fetch(`/api/shifts?weekIdentifier=${prevWeek}`)
    const prevShifts = await res.json()
    
    if (prevShifts.length === 0) {
      alert('No shifts found in previous week.')
      return
    }
    
    if (!confirm(`Found ${prevShifts.length} shifts to copy. Proceed?`)) return
    
    // In a real app we'd bulk insert here, for demo we can map
    for (const shift of prevShifts) {
      await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          position: shift.position,
          weekIdentifier: currentWeek,
          employeeId: shift.employeeId
        })
      })
    }
    fetchShifts()
  }

  const handleSaveTemplate = async () => {
    const name = prompt("Enter a name for this schedule template:")
    if (!name) return
    const templateId = `SAVED:${name}`
    
    await fetch('/api/shifts/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentWeek, templateId })
    })
    alert('Template saved!')
  }

  const handleOpenLoadTemplate = async () => {
    const res = await fetch('/api/shifts/templates')
    const data = await res.json()
    setTemplates(Array.isArray(data) ? data : [])
    setIsTemplateModalOpen(true)
  }

  const handleApplyTemplate = async (templateId: string) => {
    if (!confirm(`Apply template '${templateId.replace('SAVED:', '')}' to ${currentWeek}?`)) return
    
    await fetch('/api/shifts/templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, targetWeek: currentWeek })
    })
    setIsTemplateModalOpen(false)
    fetchShifts()
  }

  const getShiftForEmployeeAndDay = (empId: string, dayStr: string) => {
    // For our simplified grid, we just divide the 7 days.
    // Real app maps shift date.getDay() to Monday... etc.
    // For this Mock we'll just store day inside date temporarily or just find any shift match.
    // Actually, we must use a mapped index. Let's fix our approach:
    // Our DB has Date, let's just find by Day Index offset if we had real dates.
    // To keep it simple, instead of real dates, we'll assume `date` field just stores the day for now, OR we add a `dayOfWeek` to Shift model.
    // Since we didn't add dayOfWeek to Shift, we use a deterministic approach.
    // For now we'll match by looking at shifts where `position` isn't meant to hold it... Let's just use `date` properly or rebuild schema?
    return shifts.find(s => s.employeeId === empId) 
    // Wait, let's fix the API to accept `date` as the standard Monday... string for test
  }

  const handleDownloadPdf = async () => {
    setIsPdfLoading(true)
    try {
      const { toPng } = await import('html-to-image')
      const jsPDF = (await import('jspdf')).default
      
      const grid = document.getElementById('schedule-grid')
      if (!grid) return null
      
      const imgData = await toPng(grid, { pixelRatio: 2, backgroundColor: '#ffffff' })
      
      const pdf = new jsPDF('l', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      
      // Calculate height maintaining aspect ratio
      const imgElements = new Image()
      imgElements.src = imgData
      await new Promise(resolve => imgElements.onload = resolve)
      const pdfHeight = (imgElements.height * pdfWidth) / imgElements.width
      
      pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight)
      pdf.save(`Schedule_${currentWeek}.pdf`)
      return pdf
    } catch(err) {
      console.error(err)
      alert("Error generating PDF")
      return null
    } finally {
      setIsPdfLoading(false)
    }
  }

  const handleSendOut = async () => {
    if (!confirm('Send schedule PDF to all employees?')) return
    setIsEmailLoading(true)
    try {
      const { toPng } = await import('html-to-image')
      const jsPDF = (await import('jspdf')).default
      
      const grid = document.getElementById('schedule-grid')
      if (!grid) throw new Error("Grid not found")
      
      const imgData = await toPng(grid, { pixelRatio: 2, backgroundColor: '#ffffff' })
      
      const pdf = new jsPDF('l', 'mm', 'a4')
      const width = pdf.internal.pageSize.getWidth()
      
      const imgElements = new Image()
      imgElements.src = imgData
      await new Promise(resolve => imgElements.onload = resolve)
      const height = (imgElements.height * width) / imgElements.width
      
      pdf.addImage(imgData, 'PNG', 0, 10, width, height)
      
      // Get base64 string without data:application/pdf prefix
      const pdfBase64 = pdf.output('datauristring')

      const emails = employees.map((emp: any) => emp.email).filter(Boolean).join(',')
      
      const res = await fetch('/api/email/send-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emails,
          subject: `Weekly Schedule: ${currentWeek}`,
          text: `Please find attached the schedule for week ${currentWeek}.`,
          pdfBase64,
          filename: `Schedule_${currentWeek}.pdf`
        })
      })
      
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      alert('Schedule sent successfully!')
    } catch(err: any) {
      console.error(err)
      alert(`Error sending emails: ${err.message}`)
    } finally {
      setIsEmailLoading(false)
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto animate-fade-in-up">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Weekly Schedule</h1>
          <p className="text-slate-500 mt-1">Manage shifts and send schedules</p>
        </div>
        
        <div className="flex gap-3">
          <input 
            type="week" 
            value={currentWeek} 
            onChange={e => setCurrentWeek(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm max-w-[160px] focus:ring-2 focus:ring-blue-500" 
          />
          <button onClick={handleSaveTemplate} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors">
            Save as Template
          </button>
          <button onClick={handleOpenLoadTemplate} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors">
            Load Template
          </button>
          <button onClick={handlePreload} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors hidden xl:block">
            Copy Prev Week
          </button>
          <button onClick={handleDownloadPdf} disabled={isPdfLoading} className="bg-green-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            {isPdfLoading ? 'Generating...' : 'Download PDF'}
          </button>
          <button onClick={handleSendOut} disabled={isEmailLoading} className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            {isEmailLoading ? 'Sending...' : 'Send Out'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-slate-200 overflow-x-auto" id="schedule-grid">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-700 border-r border-slate-200 w-48">Employee</th>
              {DAYS.map(day => (
                <th key={day} className="p-4 font-semibold text-slate-700 text-center min-w-32 border-r border-slate-200 last:border-0">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp: any) => (
              <tr key={emp.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50/50">
                <td className="p-4 border-r border-slate-200 font-medium text-slate-800 bg-white">
                  {emp.name}
                  <div className="text-xs text-slate-400 font-normal">{emp.positions}</div>
                </td>
                {DAYS.map(day => {
                  const dayIndexMap: Record<string, number> = {
                    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
                  }
                  const targetDay = dayIndexMap[day];
                  const dayShifts = shifts.filter(s => s.employeeId === emp.id && new Date(s.date).getDay() === targetDay);
                  dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <td key={day} className="p-2 border-r border-slate-200 last:border-0 relative group align-top">
                      <div className="flex flex-col gap-2 min-h-16 h-full">
                        {dayShifts.map(shift => (
                          <div 
                            key={shift.id}
                            onClick={() => openModal(emp, day, shift)}
                            className="bg-blue-50 border border-blue-200 rounded p-2 text-center cursor-pointer hover:bg-blue-100 transition-colors"
                          >
                            <div className="text-xs font-bold text-blue-800">{shift.startTime} - {shift.endTime}</div>
                            <div className="text-[10px] text-blue-600 uppercase mt-1 tracking-wider">{shift.position}</div>
                          </div>
                        ))}
                        
                        {/* Add Button */}
                        <div 
                          onClick={() => openModal(emp, day)}
                          className={`flex items-center justify-center transition-opacity ${dayShifts.length > 0 ? 'opacity-0 h-6 mt-1' : 'h-full flex-1 opacity-0'} group-hover:opacity-100 cursor-pointer`}
                        >
                          <button className="bg-slate-100 text-slate-500 hover:text-blue-600 hover:bg-blue-50 text-xs px-2 py-1 rounded w-full">
                            + Add Shift
                          </button>
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">No employees available. Add employees first.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fade-in-up">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
            <h3 className="text-xl font-bold text-slate-800 mb-1">{selectedEmployee?.name}</h3>
            <p className="text-sm text-slate-500 mb-6">{selectedDay} Shift</p>
            
            <form onSubmit={handleSaveShift} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Start Time</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">End Time</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Position</label>
                <input type="text" value={position} onChange={e => setPosition(e.target.value)} required 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  Save Shift
                </button>
              </div>
              
              {editingShiftId && (
                <button type="button" onClick={() => handleDeleteShift(editingShiftId)} className="w-full py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors mt-2">
                  Delete Shift
                </button>
              )}
            </form>
          </div>
        </div>
      )}
      
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fade-in-up">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Saved Templates</h3>
            
            <div className="space-y-3 max-h-64 overflow-y-auto mb-6">
              {templates.length === 0 && (
                <p className="text-slate-500 text-sm">No templates saved yet.</p>
              )}
              {templates.map(tmp => (
                <div key={tmp} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="font-medium text-slate-700">{tmp.replace('SAVED:', '')}</span>
                  <button onClick={() => handleApplyTemplate(tmp)} className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold px-3 py-1.5 rounded">
                    Apply
                  </button>
                </div>
              ))}
            </div>

            <button onClick={() => setIsTemplateModalOpen(false)} className="w-full py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
