'use client';

import { useEffect, useMemo, useState } from 'react';
import ScheduleGrid from './ScheduleGrid';
import type { EmployeeRecord, ShiftRecord, TimeOffRequest } from '@/lib/types';
import { currentWeekStart } from '@/lib/helpers';

type EmployeeForm = {
  name: string;
  email: string;
  positions: string;
  payRate: number;
};

type ShiftDraft = {
  id?: number;
  employeeId?: number;
  day: number;
  startTime: string;
  endTime: string;
  position: string;
};

export default function ManagerDashboard() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>({
    name: '',
    email: '',
    positions: '',
    payRate: 17
  });
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(currentWeekStart());
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [shiftDraft, setShiftDraft] = useState<ShiftDraft>({
    day: 0,
    startTime: '09:00',
    endTime: '17:00',
    position: ''
  });
  const [archiveWeeks, setArchiveWeeks] = useState<Array<{ id: number; weekStart: string }>>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [requestActionLoading, setRequestActionLoading] = useState<number | null>(null);

  useEffect(() => {
    loadEmployees();
    loadArchive();
    loadTimeOffRequests();
  }, []);

  useEffect(() => {
    loadSchedule(weekStart);
  }, [weekStart]);

  useEffect(() => {
    if (!shiftDraft.employeeId && employees.length > 0) {
      setShiftDraft((draft) => ({ ...draft, employeeId: employees[0].id }));
    }
  }, [employees, shiftDraft.employeeId]);

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const payload = await response.json();
      setEmployees(payload.employees ?? []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadArchive = async () => {
    try {
      const response = await fetch('/api/schedules/archive');
      const payload = await response.json();
      setArchiveWeeks(payload.weeks ?? []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadTimeOffRequests = async () => {
    try {
      const response = await fetch('/api/time-off');
      const payload = await response.json();
      setTimeOffRequests(payload.requests ?? []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadSchedule = async (week: string) => {
    const response = await fetch(`/api/schedules?week=${encodeURIComponent(week)}`);
    if (!response.ok) {
      setShifts([]);
      setScheduleId(null);
      return;
    }
    const payload = await response.json();
    setScheduleId(payload.schedule?.id ?? null);
    setShifts(payload.shifts ?? []);
  };

  const ensureSchedule = async () => {
    if (scheduleId) {
      return scheduleId;
    }
    const response = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart })
    });
    const payload = await response.json();
    setScheduleId(payload.schedule?.id ?? null);
    return payload.schedule?.id ?? null;
  };

  const handleEmployeeSubmit = async () => {
    const positions = employeeForm.positions
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const payload = {
      name: employeeForm.name,
      email: employeeForm.email,
      positions,
      payRate: employeeForm.payRate
    };

    const endpoint = editingEmployeeId ? `/api/employees/${editingEmployeeId}` : '/api/employees';
    const method = editingEmployeeId ? 'PUT' : 'POST';

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return;
    }
    await loadEmployees();
    setEmployeeForm({ name: '', email: '', positions: '', payRate: 17 });
    setEditingEmployeeId(null);
    loadSchedule(weekStart);
  };

  const handleEmployeeEdit = (employee: EmployeeRecord) => {
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      name: employee.name,
      email: employee.email,
      positions: employee.positions.join(', '),
      payRate: employee.payRate
    });
  };

  const handleEmployeeDelete = async (id: number) => {
    await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    await loadEmployees();
    loadSchedule(weekStart);
  };

  const resetShiftDraft = () => {
    setShiftDraft({
      day: 0,
      startTime: '09:00',
      endTime: '17:00',
      position: '',
      employeeId: employees[0]?.id
    });
    setStatusMessage(null);
  };

  const handleShiftSubmit = async () => {
    if (!shiftDraft.employeeId) {
      return;
    }
    const sid = await ensureSchedule();
    if (!sid) {
      return;
    }
    const method = shiftDraft.id ? 'PUT' : 'POST';
    const url = shiftDraft.id ? `/api/shifts/${shiftDraft.id}` : '/api/shifts';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scheduleId: sid,
      employeeId: shiftDraft.employeeId,
      day: shiftDraft.day,
      startTime: shiftDraft.startTime,
      endTime: shiftDraft.endTime,
      position: shiftDraft.position,
      weekStart
    })
  });
    if (!response.ok) {
      return;
    }
    await loadSchedule(weekStart);
    resetShiftDraft();
  };

  const handleShiftDelete = async (id: number) => {
    await fetch(`/api/shifts/${id}`, { method: 'DELETE' });
    await loadSchedule(weekStart);
  };

  const handleShiftEdit = (shift: ShiftRecord) => {
    setShiftDraft({
      id: shift.id,
      employeeId: shift.employeeId,
      day: shift.day,
      startTime: shift.startTime,
      endTime: shift.endTime,
      position: shift.position
    });
  };

  const archiveAction = async (sourceWeek: string) => {
    await fetch('/api/schedules/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceWeek, targetWeek: weekStart })
    });
    await loadSchedule(weekStart);
    setStatusMessage(`Loaded shifts from ${sourceWeek} into ${weekStart}.`);
  };

  const handleSendEmails = async () => {
    setSendingEmails(true);
    const response = await fetch('/api/send-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart })
    });
    const payload = await response.json();
    setSendingEmails(false);
    if (payload.success) {
      setStatusMessage('Schedule emailed to every employee.');
    } else {
      setStatusMessage('Errors: ' + (payload.errors ?? []).join(' | '));
    }
  };

  const handleRequestDecision = async (requestId: number, status: 'approved' | 'denied') => {
    setRequestActionLoading(requestId);
    await fetch(`/api/time-off/${requestId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    setRequestActionLoading(null);
    await loadTimeOffRequests();
  };

  const hoursSummary = useMemo(() => {
    const byEmployee = shifts.reduce<Record<number, number>>((acc, shift) => {
      const startParts = shift.startTime.split(':').map(Number);
      const endParts = shift.endTime.split(':').map(Number);
      const startMinutes = startParts[0] * 60 + startParts[1];
      const endMinutes = endParts[0] * 60 + endParts[1];
      const minutes = endMinutes - startMinutes;
      acc[shift.employeeId] = (acc[shift.employeeId] ?? 0) + minutes;
      return acc;
    }, {});
    return employees.map((employee) => ({
      employee,
      minutes: byEmployee[employee.id] ?? 0
    }));
  }, [shifts, employees]);

  return (
    <div className="manager-dashboard">
      <section className="section">
        <div className="section__header">
          <div>
            <p className="section__title">Employee roster</p>
            <p className="section__subtitle">
              Add or edit workers with emails, positions, and pay rates.
            </p>
          </div>
          <div className="section__actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                setEmployeeForm({ name: '', email: '', positions: '', payRate: 17 });
                setEditingEmployeeId(null);
              }}
            >
              Clear form
            </button>
          </div>
        </div>

        <div className="form-grid">
          <label className="form-field">
            Name
            <input
              value={employeeForm.name}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label className="form-field">
            Email
            <input
              value={employeeForm.email}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>
          <label className="form-field">
            Positions (comma separated)
            <input
              value={employeeForm.positions}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, positions: event.target.value }))}
            />
          </label>
          <label className="form-field">
            Pay rate ($)
            <input
              type="number"
              min={0}
              value={employeeForm.payRate}
              onChange={(event) =>
                setEmployeeForm((prev) => ({ ...prev, payRate: Number(event.target.value) || 0 }))
              }
            />
          </label>
        </div>

        <div className="section__actions" style={{ marginTop: '16px' }}>
          <button type="button" className="button button--primary" onClick={handleEmployeeSubmit}>
            {editingEmployeeId ? 'Update employee' : 'Add employee'}
          </button>
        </div>

        <div className="cards">
          {employees.map((employee) => (
            <div key={employee.id} className="card">
              <div className="card__content">
                <p className="card__title">{employee.name}</p>
                <p className="card__meta">{employee.email}</p>
                <p className="card__meta">
                  {employee.positions.join(', ')} • ${employee.payRate.toFixed(2)}
                </p>
              </div>
              <div className="section__actions">
                <button type="button" className="button button--ghost" onClick={() => handleEmployeeEdit(employee)}>
                  Edit
                </button>
                <button type="button" className="button button--danger" onClick={() => handleEmployeeDelete(employee.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__header">
          <div>
            <p className="section__title">Weekly schedule</p>
            <p className="section__subtitle">
              Choose a week, add shifts, then download or email the PDF.
            </p>
          </div>
          <div className="section__actions">
            <label className="form-field" style={{ margin: 0 }}>
              Week start (Monday)
              <input type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
            </label>
            <a className="button button--ghost" href={`/api/schedules/${weekStart}/pdf`}>
              Download PDF
            </a>
            <button type="button" className="button button--accent" onClick={handleSendEmails}>
              {sendingEmails ? 'Sending...' : 'Send to employees'}
            </button>
          </div>
        </div>
        {statusMessage && <p className="status-message">{statusMessage}</p>}

        <div className="cards">
          <div className="hours-panel">
            <p className="section__title" style={{ fontSize: '1rem' }}>
              Shift editor
            </p>
            <div className="form-grid" style={{ marginTop: '12px' }}>
              <label className="form-field">
                Employee
                <select
                  value={shiftDraft.employeeId ?? ''}
                  onChange={(event) => setShiftDraft((prev) => ({ ...prev, employeeId: Number(event.target.value) }))}
                >
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Day
                <select
                  value={shiftDraft.day}
                  onChange={(event) => setShiftDraft((prev) => ({ ...prev, day: Number(event.target.value) }))}
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </label>
              <label className="form-field">
                Start
                <input
                  type="time"
                  value={shiftDraft.startTime}
                  onChange={(event) => setShiftDraft((prev) => ({ ...prev, startTime: event.target.value }))}
                />
              </label>
              <label className="form-field">
                End
                <input
                  type="time"
                  value={shiftDraft.endTime}
                  onChange={(event) => setShiftDraft((prev) => ({ ...prev, endTime: event.target.value }))}
                />
              </label>
              <label className="form-field">
                Position
                <input
                  value={shiftDraft.position}
                  onChange={(event) => setShiftDraft((prev) => ({ ...prev, position: event.target.value }))}
                />
              </label>
            </div>
            <div className="section__actions" style={{ marginTop: '12px' }}>
              <button type="button" className="button button--primary" onClick={handleShiftSubmit}>
                {shiftDraft.id ? 'Save shift' : 'Add shift'}
              </button>
            </div>
          </div>
          <div className="hours-panel">
            <p className="section__title" style={{ fontSize: '1rem' }}>
              Weekly hours
            </p>
            <div className="hours-panel__item" style={{ marginTop: '12px', flexDirection: 'column', gap: '4px' }}>
              {hoursSummary.length > 0 ? (
                hoursSummary.map((entry) => (
                  <div key={entry.employee.id} className="hours-panel__item">
                    <span>{entry.employee.name}</span>
                    <span>{(entry.minutes / 60).toFixed(1)} hrs</span>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>No shifts yet.</p>
              )}
            </div>
          </div>
        </div>

        <ScheduleGrid employees={employees} shifts={shifts} onEdit={handleShiftEdit} onDelete={handleShiftDelete} />
      </section>

      <section className="section">
        <div className="section__header">
          <div>
            <p className="section__title">Schedule archive</p>
            <p className="section__subtitle">Copy any past week into the current calendar.</p>
          </div>
        </div>
        <div className="archive-grid">
          {archiveWeeks.length ? (
            archiveWeeks.map((item) => (
              <div key={item.id} className="archive-card">
                <p className="archive-card__title">{item.weekStart}</p>
                <p className="section__subtitle">Saved archive</p>
                <button className="button button--ghost" onClick={() => archiveAction(item.weekStart)}>
                  Load
                </button>
              </div>
            ))
          ) : (
            <div className="archive-card">
              <p className="section__subtitle">No previous schedules yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section__header">
          <div>
            <p className="section__title">Time-off requests</p>
            <p className="section__subtitle">Approve or deny and notify employees instantly.</p>
          </div>
        </div>
        <div className="time-off-list">
          {timeOffRequests.length === 0 && <p style={{ color: 'var(--slate-500)' }}>No outstanding requests.</p>}
          {timeOffRequests.map((request) => (
            <div key={request.id} className="time-off-card">
              <div className="request-row">
                <p className="time-off-card__title">
                  {request.employeeName} • {request.date}
                </p>
                <p className="time-off-card__status">{request.status}</p>
              </div>
              <p className="time-off-card__reason">{request.reason}</p>
              <div className="section__actions" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="button button--accent"
                  disabled={request.status !== 'pending'}
                  onClick={() => handleRequestDecision(request.id, 'approved')}
                >
                  {requestActionLoading === request.id ? 'Saving...' : 'Approve'}
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  disabled={request.status !== 'pending'}
                  onClick={() => handleRequestDecision(request.id, 'denied')}
                >
                  {requestActionLoading === request.id ? 'Saving...' : 'Deny'}
                </button>
              </div>
              {request.managerNotes && (
                <p style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--emerald-500)' }}>
                  Manager note: {request.managerNotes}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
