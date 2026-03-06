import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const api = axios.create({ baseURL: API_BASE });

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_SHIFT_FORM = { position: '', startTime: '', endTime: '', note: '' };

const getIsoWeekStart = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
};

const formatWeekLabel = (weekStart) => {
  if (!weekStart) {
    return '';
  }
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
};

const App = () => {
  const [employees, setEmployees] = useState([]);
  const [weekStart, setWeekStart] = useState(getIsoWeekStart(new Date()));
  const [scheduleId, setScheduleId] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [archive, setArchive] = useState([]);
  const [archiveCloneId, setArchiveCloneId] = useState('');
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const [activeCell, setActiveCell] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [shiftFormState, setShiftFormState] = useState({ ...DEFAULT_SHIFT_FORM });

  const [employeeForm, setEmployeeForm] = useState({
    id: '',
    name: '',
    email: '',
    positionsInput: ''
  });
  const [editingEmployee, setEditingEmployee] = useState(null);

  const shiftRowsByKey = useMemo(() => {
    const map = {};
    shifts.forEach((shift) => {
      const key = `${shift.employeeId}_${shift.day}`;
      map[key] = map[key] || [];
      map[key].push(shift);
    });
    return map;
  }, [shifts]);

  const loadEmployees = useCallback(async () => {
    try {
      const response = await api.get('/api/employees');
      setEmployees(response.data.employees);
    } catch (error) {
      setErrorMessage('Unable to load employees.');
    }
  }, []);

  const loadArchive = useCallback(async () => {
    try {
      const response = await api.get('/api/schedules/archive');
      setArchive(response.data.schedules);
    } catch (error) {
      setErrorMessage('Unable to load saved schedules.');
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    if (!weekStart) {
      return;
    }
    setLoadingSchedule(true);
    try {
      const response = await api.get('/api/schedules', {
        params: {
          weekStart
        }
      });
      const schedule = response.data.schedule;
      if (!schedule) {
        setScheduleId(null);
        setShifts([]);
        setIsDirty(false);
      } else {
        setScheduleId(schedule.id);
        setShifts(schedule.shifts);
        setIsDirty(false);
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Failed to load schedule.');
    } finally {
      setLoadingSchedule(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadEmployees();
    loadArchive();
  }, [loadEmployees, loadArchive]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(''), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [statusMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [errorMessage]);

  const handleWeekChange = (event) => {
    const normalized = getIsoWeekStart(event.target.value);
    if (normalized) {
      setWeekStart(normalized);
    }
  };

  const handleShiftFormChange = (field, value) => {
    setShiftFormState((prev) => ({ ...prev, [field]: value }));
  };

  const openCellEditor = (employeeId, day) => {
    setActiveCell({ employeeId, day });
    setActiveShift(null);
    setShiftFormState({ ...DEFAULT_SHIFT_FORM });
  };

  const handleEditShift = (shift) => {
    setActiveCell({ employeeId: shift.employeeId, day: shift.day });
    setActiveShift(shift);
    setShiftFormState({
      position: shift.position,
      startTime: shift.startTime || '',
      endTime: shift.endTime || '',
      note: shift.note || ''
    });
  };

  const handleShiftSubmit = (event) => {
    event.preventDefault();
    if (!activeCell) {
      return;
    }

    if (!shiftFormState.position.trim()) {
      setErrorMessage('Position is required for a shift.');
      return;
    }

    const payload = {
      id: activeShift?.id ?? `local-${Date.now()}`,
      employeeId: activeCell.employeeId,
      day: activeCell.day,
      position: shiftFormState.position.trim(),
      startTime: shiftFormState.startTime || null,
      endTime: shiftFormState.endTime || null,
      note: shiftFormState.note || null
    };

    setShifts((prev) => {
      if (activeShift) {
        return prev.map((shift) => (shift.id === activeShift.id ? payload : shift));
      }
      return [...prev, payload];
    });
    setIsDirty(true);
    setActiveShift(null);
    setShiftFormState({ ...DEFAULT_SHIFT_FORM });
  };

  const handleDeleteShift = (shiftId) => {
    setShifts((prev) => prev.filter((shift) => shift.id !== shiftId));
    setIsDirty(true);
    if (activeShift?.id === shiftId) {
      setActiveShift(null);
      setShiftFormState({ ...DEFAULT_SHIFT_FORM });
    }
  };

  const handleSaveSchedule = async () => {
    if (!weekStart) {
      return;
    }
    setSaving(true);
    try {
      const payload = shifts.map(({ id, ...rest }) => rest);
      const response = await api.post('/api/schedules', {
        weekStart,
        shifts: payload
      });
      const saved = response.data.schedule;
      setScheduleId(saved?.id ?? null);
      setShifts(saved?.shifts ?? []);
      setIsDirty(false);
      setStatusMessage('Schedule saved.');
      await loadArchive();
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!scheduleId) {
      setErrorMessage('Save a schedule before downloading the PDF.');
      return;
    }
    try {
      const response = await api.get(`/api/schedules/${scheduleId}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `schedule-${weekStart}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage('Unable to download the schedule PDF.');
    }
  };

  const handleSendEmails = async () => {
    if (!scheduleId) {
      setErrorMessage('Save the schedule before sending emails.');
      return;
    }
    setSending(true);
    try {
      const response = await api.post('/api/email/send', { scheduleId });
      const successful = response.data.delivery.results.filter((result) => result.skipped === false && !result.error).length;
      setStatusMessage(`Emails queued (${successful} sent) for ${formatWeekLabel(weekStart)}.`);
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Failed to send emails.');
    } finally {
      setSending(false);
    }
  };

  const handleCloneArchive = async () => {
    if (!archiveCloneId) {
      setErrorMessage('Choose a saved schedule to clone.');
      return;
    }
    if (!weekStart) {
      setErrorMessage('Select a target week before cloning.');
      return;
    }
    try {
      const response = await api.post(`/api/schedules/${archiveCloneId}/clone`, { weekStart });
      const schedule = response.data.schedule;
      setScheduleId(schedule?.id ?? null);
      setShifts(schedule?.shifts ?? []);
      setIsDirty(false);
      setStatusMessage('Previous week copied into this week.');
      await loadArchive();
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Unable to clone schedule.');
    }
  };

  const handleEmployeeSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = employeeForm.name.trim();
    const trimmedPositions = employeeForm.positionsInput.trim();
    const payload = {
      name: trimmedName,
      email: employeeForm.email.trim() || null,
      positions: trimmedPositions ? trimmedPositions.split(',').map((part) => part.trim()).filter(Boolean) : []
    };
    if (!payload.name || payload.positions.length === 0) {
      setErrorMessage('Employee name and positions are required.');
      return;
    }

    try {
      if (editingEmployee) {
        const response = await api.put(`/api/employees/${editingEmployee.id}`, payload);
        setEmployees(response.data.employees);
        setStatusMessage('Employee updated.');
      } else {
        const response = await api.post('/api/employees', payload);
        setEmployees(response.data.employees);
        setStatusMessage('Employee added.');
      }
      setEmployeeForm({ id: '', name: '', email: '', positionsInput: '' });
      setEditingEmployee(null);
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Failed to save employee.');
    }
  };

  const handleEmployeeEdit = (employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      id: employee.id,
      name: employee.name,
      email: employee.email || '',
      positionsInput: (employee.positions || []).join(', ')
    });
  };

  const handleEmployeeDelete = async (employeeId) => {
    try {
      const response = await api.delete(`/api/employees/${employeeId}`);
      setEmployees(response.data.employees);
      setShifts((prev) => prev.filter((shift) => shift.employeeId !== employeeId));
      setStatusMessage('Employee removed.');
      if (activeCell?.employeeId === employeeId) {
        setActiveCell(null);
        setActiveShift(null);
        setShiftFormState({ ...DEFAULT_SHIFT_FORM });
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Unable to remove employee.');
    }
  };

  const shiftListForCell = (employeeId, day) => {
    const key = `${employeeId}_${day}`;
    return shiftRowsByKey[key] || [];
  };

  const weekDisplay = formatWeekLabel(weekStart);

  return (
    <div className="screen">
      <header className="hero">
        <div>
          <p className="eyebrow">Restaurant Scheduler</p>
          <h1>Weekly staff schedule</h1>
        </div>
        <div className="week-controls">
          <label className="field-label">
            Week starting
            <input type="date" value={weekStart || ''} onChange={handleWeekChange} />
          </label>
          <p className="week-label">{weekDisplay}</p>
          <button type="button" className="primary" onClick={handleSaveSchedule} disabled={saving}>
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
          <button type="button" onClick={handleDownloadPdf} disabled={!scheduleId}>
            Download PDF
          </button>
          <button type="button" onClick={handleSendEmails} disabled={!scheduleId || sending}>
            {sending ? 'Sending…' : 'Send emails'}
          </button>
        </div>
      </header>

      {statusMessage && <p className="status success">{statusMessage}</p>}
      {errorMessage && <p className="status error">{errorMessage}</p>}

      <main>
        <section className="panel">
          <header>
            <h2>Employees</h2>
          </header>
          <form className="employee-form" onSubmit={handleEmployeeSubmit}>
            <div className="field-group">
              <label>
                Name
                <input
                  type="text"
                  value={employeeForm.name}
                  onChange={(event) => setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={(event) => setEmployeeForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
            </div>
            <label>
              Positions (comma separated)
              <input
                type="text"
                value={employeeForm.positionsInput}
                onChange={(event) => setEmployeeForm((prev) => ({ ...prev, positionsInput: event.target.value }))}
                required
              />
            </label>
            <div className="form-actions">
              <button type="submit">{editingEmployee ? 'Update employee' : 'Add employee'}</button>
              {editingEmployee && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setEditingEmployee(null);
                    setEmployeeForm({ id: '', name: '', email: '', positionsInput: '' });
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          <div className="employee-list">
            {employees.map((employee) => (
              <article key={employee.id} className="employee-card">
                <div>
                  <h3>{employee.name}</h3>
                  <p>{employee.positions.join(', ')}</p>
                  <p className="muted">{employee.email || 'No email on file'}</p>
                </div>
                <div className="employee-actions">
                  <button type="button" onClick={() => handleEmployeeEdit(employee)}>
                    Edit
                  </button>
                  <button type="button" className="ghost danger" onClick={() => handleEmployeeDelete(employee.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {!employees.length && <p className="muted">Add employees to start building the weekly grid.</p>}
          </div>
        </section>

        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>Weekly grid</h2>
              <p className="muted">Add shifts per employee for each day. Multiple positions are allowed per day.</p>
            </div>
            <div className="archive-controls">
              <label>
                Clone from saved
                <select value={archiveCloneId} onChange={(event) => setArchiveCloneId(event.target.value)}>
                  <option value="">Choose a week</option>
                  {archive.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatWeekLabel(item.weekStart)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={handleCloneArchive} disabled={!archiveCloneId}>
                Clone week
              </button>
            </div>
          </header>
          {loadingSchedule ? (
            <p className="muted">Loading schedule…</p>
          ) : (
            <div className="grid-wrapper">
              <table className="schedule-grid">
                <thead>
                  <tr>
                    <th>Employee</th>
                    {DAY_NAMES.map((day) => (
                      <th key={day}>
                        <span>{day}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="employee-column">
                        <strong>{employee.name}</strong>
                        <span>{employee.positions.join(', ')}</span>
                      </td>
                      {DAY_NAMES.map((_, dayIndex) => (
                        <td key={`${employee.id}-${dayIndex}`}>
                          <div className="shift-list">
                            {shiftListForCell(employee.id, dayIndex).map((shift) => (
                              <div key={shift.id} className="shift-card">
                                <div>
                                  <strong>{shift.position}</strong>
                                  <div className="shift-time">
                                    {[shift.startTime, shift.endTime].some(Boolean)
                                      ? `${shift.startTime || 'TBD'} – ${shift.endTime || 'TBD'}`
                                      : 'Time TBD'}
                                  </div>
                                  {shift.note && <div className="muted">{shift.note}</div>}
                                </div>
                                <div className="shift-actions">
                                  <button type="button" onClick={() => handleEditShift(shift)}>
                                    Edit
                                  </button>
                                  <button type="button" className="ghost danger" onClick={() => handleDeleteShift(shift.id)}>
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button type="button" className="link-button" onClick={() => openCellEditor(employee.id, dayIndex)}>
                            + Add shift
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!employees.length && <p className="muted">You need at least one employee before adding shifts.</p>}
            </div>
          )}
          <div className="shift-form">
            <h3>{activeShift ? 'Edit shift' : 'Add shift'}</h3>
            <p className="muted">
              {activeCell
                ? `Employee: ${employees.find((emp) => emp.id === activeCell.employeeId)?.name || 'Unknown'}, Day: ${
                    DAY_NAMES[activeCell.day]
                  }`
                : 'Tap a cell to start adding a shift.'}
            </p>
            <form onSubmit={handleShiftSubmit}>
              <label>
                Position
                <input
                  type="text"
                  value={shiftFormState.position}
                  onChange={(event) => handleShiftFormChange('position', event.target.value)}
                  required
                />
              </label>
              <div className="field-group">
                <label>
                  Start time
                  <input
                    type="time"
                    value={shiftFormState.startTime || ''}
                    onChange={(event) => handleShiftFormChange('startTime', event.target.value)}
                  />
                </label>
                <label>
                  End time
                  <input
                    type="time"
                    value={shiftFormState.endTime || ''}
                    onChange={(event) => handleShiftFormChange('endTime', event.target.value)}
                  />
                </label>
              </div>
              <label>
                Note
                <input
                  type="text"
                  placeholder="Optional instructions"
                  value={shiftFormState.note || ''}
                  onChange={(event) => handleShiftFormChange('note', event.target.value)}
                />
              </label>
              <div className="form-actions">
                <button type="submit" disabled={!activeCell}>
                  {activeShift ? 'Update shift' : 'Save shift'}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setActiveShift(null);
                    setShiftFormState({ ...DEFAULT_SHIFT_FORM });
                  }}
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
