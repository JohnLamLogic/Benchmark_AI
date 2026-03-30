'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EmployeeRecord, ShiftRecord, TimeOffRequest } from '@/lib/types';
import { currentWeekStart, DAY_LABELS } from '@/lib/helpers';

type RequestForm = {
  date: string;
  reason: string;
};

export default function EmployeeDashboard() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(currentWeekStart());
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [hoursSummary, setHoursSummary] = useState<Array<{ weekStart: string; totalMinutes: number }>>([]);
  const [requestForm, setRequestForm] = useState<RequestForm>({ date: '', reason: '' });
  const [archiveWeeks, setArchiveWeeks] = useState<Array<{ weekStart: string }>>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployees();
    fetchArchive();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchSchedule();
      fetchTimeOffRequests();
      fetchHoursSummary();
    }
  }, [selectedEmployeeId, weekStart]);

  const fetchEmployees = async () => {
    const response = await fetch('/api/employees');
    const payload = await response.json();
    setEmployees(payload.employees ?? []);
    if (!selectedEmployeeId && payload.employees?.length) {
      setSelectedEmployeeId(payload.employees[0].id);
    }
  };

  const fetchArchive = async () => {
    const response = await fetch('/api/schedules/archive');
    const payload = await response.json();
    setArchiveWeeks(payload.weeks ?? []);
  };

  const fetchSchedule = async () => {
    const response = await fetch(`/api/schedules?week=${encodeURIComponent(weekStart)}`);
    if (!response.ok) {
      setShifts([]);
      return;
    }
    const payload = await response.json();
    setShifts(payload.shifts ?? []);
  };

  const fetchTimeOffRequests = async () => {
    if (!selectedEmployeeId) return;
    const response = await fetch(`/api/time-off?employeeId=${selectedEmployeeId}`);
    const payload = await response.json();
    setTimeOffRequests(payload.requests ?? []);
  };

  const fetchHoursSummary = async () => {
    if (!selectedEmployeeId) return;
    const response = await fetch(`/api/employee-hours?employeeId=${selectedEmployeeId}`);
    const payload = await response.json();
    setHoursSummary(payload.summary ?? []);
  };

  const submitRequest = async () => {
    if (!selectedEmployeeId || !requestForm.date || !requestForm.reason) {
      return;
    }
    const response = await fetch('/api/time-off', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: selectedEmployeeId,
        date: requestForm.date,
        reason: requestForm.reason
      })
    });
    if (response.ok) {
      setRequestForm({ date: '', reason: '' });
      fetchTimeOffRequests();
      setStatusMessage('Request sent.');
    }
  };

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  const employeeShifts = shifts.filter((shift) => shift.employeeId === selectedEmployeeId);

  const weeklyShiftMap = useMemo(() => {
    const map: Record<number, ShiftRecord[]> = {};
    employeeShifts.forEach((shift) => {
      if (!map[shift.day]) {
        map[shift.day] = [];
      }
      map[shift.day].push(shift);
    });
    return map;
  }, [employeeShifts]);

  return (
    <div className="employee-dashboard">
      <section className="section">
        <div className="section__header">
          <div>
            <p className="section__title">Employee hub</p>
            <p className="section__subtitle">Select your name to view schedules, pay, and hours history.</p>
          </div>
          <div className="section__actions">
            <select
              className="form-field"
              value={selectedEmployeeId ?? ''}
              onChange={(event) => setSelectedEmployeeId(Number(event.target.value))}
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value)}
              className="form-field"
            />
          </div>
        </div>

        <div className="cards">
          <div className="hours-panel">
            <p className="section__title" style={{ fontSize: '1rem' }}>
              Current schedule
            </p>
            <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
              {DAY_LABELS.map((dayLabel, index) => (
                <div key={dayLabel} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                  <p className="section__subtitle" style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    {dayLabel}
                  </p>
                  {weeklyShiftMap[index]?.length ? (
                    weeklyShiftMap[index].map((shift) => (
                      <p key={shift.id} style={{ margin: '4px 0', fontSize: '0.9rem', color: 'var(--white)' }}>
                        {shift.startTime} - {shift.endTime} ({shift.position})
                      </p>
                    ))
                  ) : (
                    <p style={{ margin: '4px 0', fontSize: '0.8rem', color: 'var(--slate-500)' }}>No work scheduled.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="hours-panel">
            <p className="section__title" style={{ fontSize: '1rem' }}>
              Pay & hours
            </p>
            <div style={{ marginTop: '12px' }}>
              {selectedEmployee ? (
                <>
                  <p style={{ margin: 0, color: 'var(--white)', fontWeight: 600 }}>
                    Pay rate: ${selectedEmployee.payRate.toFixed(2)} / hr
                  </p>
                  <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                    <p className="section__subtitle" style={{ fontSize: '0.8rem', margin: '0 0 6px' }}>
                      Historical weekly hours
                    </p>
                    {hoursSummary.length > 0 ? (
                      hoursSummary.map((entry) => (
                        <p key={entry.weekStart} style={{ margin: '2px 0', fontSize: '0.85rem', color: 'var(--white)' }}>
                          {entry.weekStart}: {(entry.totalMinutes / 60).toFixed(1)} hrs
                        </p>
                      ))
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--slate-500)' }}>No logged hours yet.</p>
                    )}
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--slate-500)', fontSize: '0.9rem' }}>Select yourself to see pay details.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section__header">
          <div>
            <p className="section__title">Request time off</p>
            <p className="section__subtitle">Tell your manager the date and reason.</p>
          </div>
          {statusMessage && <p className="status-message">{statusMessage}</p>}
        </div>
        <div className="form-grid">
          <label className="form-field">
            Date
            <input
              type="date"
              value={requestForm.date}
              onChange={(event) => setRequestForm((prev) => ({ ...prev, date: event.target.value }))}
            />
          </label>
          <label className="form-field" style={{ gridColumn: 'span 2' }}>
            Reason
            <input
              value={requestForm.reason}
              onChange={(event) => setRequestForm((prev) => ({ ...prev, reason: event.target.value }))}
            />
          </label>
        </div>
        <div className="section__actions" style={{ marginTop: '12px' }}>
          <button type="button" className="button button--primary" onClick={submitRequest}>
            Submit request
          </button>
        </div>
        <div className="time-off-list">
          {timeOffRequests.length === 0 && <p style={{ color: 'var(--slate-500)' }}>No prior requests yet.</p>}
          {timeOffRequests.map((request) => (
            <div key={request.id} className="time-off-card">
              <div className="request-row">
                <span>{request.date}</span>
                <span>{request.status}</span>
              </div>
              <p className="time-off-card__reason">{request.reason}</p>
              {request.managerNotes && (
                <p className="time-off-card__status">Manager note: {request.managerNotes}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__header">
          <div>
            <p className="section__title">All published schedules</p>
            <p className="section__subtitle">Download any archived week that is ready.</p>
          </div>
        </div>
        <div className="schedule-links">
          {archiveWeeks.length ? (
            archiveWeeks.map((week) => (
              <a key={week.weekStart} className="archive-link" href={`/api/schedules/${week.weekStart}/pdf`}>
                <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--slate-500)' }}>Week</p>
                <p style={{ margin: '4px 0 0', fontSize: '1.1rem', color: 'var(--white)', fontWeight: 600 }}>
                  {week.weekStart}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--slate-400)' }}>Click to download</p>
              </a>
            ))
          ) : (
            <div className="archive-link">
              <p style={{ margin: 0, color: 'var(--slate-500)' }}>No schedules archived yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
