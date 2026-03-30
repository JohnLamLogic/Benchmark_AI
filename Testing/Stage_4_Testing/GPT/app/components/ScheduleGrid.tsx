'use client';

import type { ShiftRecord, EmployeeRecord } from '@/lib/types';
import { DAY_SHORT } from '@/lib/helpers';

interface ScheduleGridProps {
  employees: EmployeeRecord[];
  shifts: ShiftRecord[];
  onEdit: (shift: ShiftRecord) => void;
  onDelete: (shiftId: number) => void;
}

export default function ScheduleGrid({ employees, shifts, onEdit, onDelete }: ScheduleGridProps) {
  return (
    <div className="schedule-grid">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            {DAY_SHORT.map((day) => (
              <th key={day}>{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>{employee.name}</td>
              {DAY_SHORT.map((_, dayIndex) => {
                const dayShifts = shifts.filter(
                  (shift) => shift.employeeId === employee.id && shift.day === dayIndex
                );

                return (
                  <td key={dayIndex}>
                    {dayShifts.length > 0 ? (
                      dayShifts.map((shift) => (
                        <div key={shift.id} className="shift-card">
                          <div className="shift-card__time">
                            {shift.startTime} - {shift.endTime}
                          </div>
                          <div className="shift-card__position">{shift.position}</div>
                          <div className="shift-card__actions">
                            <button type="button" className="button button--primary" onClick={() => onEdit(shift)}>
                              Edit
                            </button>
                            <button type="button" className="button button--danger" onClick={() => onDelete(shift.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="shift-card__position">No shift assigned.</p>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
