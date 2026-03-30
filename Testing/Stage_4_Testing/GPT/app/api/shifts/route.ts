import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { normalizeWeekStart } from '@/lib/helpers';

export async function POST(req: NextRequest) {
  const { scheduleId, employeeId, day, startTime, endTime, position, weekStart } = await req.json();
  if (!scheduleId || !employeeId || day === undefined || !startTime || !endTime || !position) {
    return NextResponse.json({ error: 'All shift fields are required.' }, { status: 400 });
  }
  let scheduleRow = db.prepare('SELECT id FROM schedules WHERE id = ?').get(scheduleId);
  if (!scheduleRow) {
    if (!weekStart) {
      return NextResponse.json({ error: 'Schedule not found.' }, { status: 404 });
    }
    const normalizedWeek = normalizeWeekStart(weekStart);
    let normalizedRow = db.prepare('SELECT id FROM schedules WHERE week_start = ?').get(normalizedWeek);
    if (!normalizedRow) {
      const info = db.prepare('INSERT INTO schedules (week_start) VALUES (?)').run(normalizedWeek);
      normalizedRow = { id: Number(info.lastInsertRowid) };
    }
    scheduleRow.id = normalizedRow.id;
  }
  const employeeRow = db.prepare('SELECT id FROM employees WHERE id = ?').get(employeeId);
  if (!employeeRow) {
    return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
  }
  const info = db
    .prepare(
      'INSERT INTO shifts (schedule_id, employee_id, day, start_time, end_time, position) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(scheduleId, employeeId, day, startTime, endTime, position);

  const row = db
    .prepare(
      `SELECT shifts.*, employees.name AS employee_name
       FROM shifts
       JOIN employees ON employees.id = shifts.employee_id
       WHERE shifts.id = ?`
    )
    .get(info.lastInsertRowid);

  return NextResponse.json({
    shift: {
      id: row.id,
      scheduleId: row.schedule_id,
      employeeId: row.employee_id,
      day: row.day,
      startTime: row.start_time,
      endTime: row.end_time,
      position: row.position,
      employeeName: row.employee_name
    }
  });
}
