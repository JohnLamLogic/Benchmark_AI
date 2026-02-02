import { useState } from 'react'
import './App.css'
import { Plus, Trash2, Calendar, Download } from 'lucide-react'
import EmployeeManager from './components/EmployeeManager'
import ScheduleGrid from './components/ScheduleGrid'
import { generateId } from './utils'
import { downloadSchedulePdf } from './exportPdf'

function App() {
  const [employees, setEmployees] = useState([
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' }
  ])

  // shifts: { id, employeeId, day, time, position }
  const [shifts, setShifts] = useState([])

  const handleAddEmployee = (name) => {
    setEmployees([...employees, { id: generateId(), name }])
  }

  const handleDeleteEmployee = (id) => {
    setEmployees(employees.filter(emp => emp.id !== id))
    // Also remove shifts for this employee
    setShifts(shifts.filter(shift => shift.employeeId !== id))
  }

  const handleAddShift = (shiftData) => {
    setShifts([...shifts, { id: generateId(), ...shiftData }])
  }

  const handleEditShift = (updatedShift) => {
    setShifts(shifts.map(s => s.id === updatedShift.id ? updatedShift : s))
  }

  const handleDeleteShift = (shiftId) => {
    setShifts(shifts.filter(s => s.id !== shiftId))
  }

  return (
    <div className="app-container">
      <header className="app-header glass-panel">
        <div className="header-content">
          <div className="logo">
            <Calendar className="icon-logo" />
            <h1>ShiftMaster</h1>
          </div>
          <button
            className="btn-primary"
            onClick={() => downloadSchedulePdf(employees, shifts)}
            disabled={employees.length === 0}
          >
            <Download size={18} />
            <span>Export Schedule</span>
          </button>
        </div>
      </header>

      <main className="main-layout">
        <aside className="sidebar glass-panel">
          <h2>Team Members</h2>
          <EmployeeManager
            employees={employees}
            onAdd={handleAddEmployee}
            onDelete={handleDeleteEmployee}
          />
        </aside>

        <section className="schedule-area glass-panel">
          <ScheduleGrid
            employees={employees}
            shifts={shifts}
            onAddShift={handleAddShift}
            onEditShift={handleEditShift}
            onDeleteShift={handleDeleteShift}
          />
        </section>
      </main>
    </div>
  )
}

export default App
