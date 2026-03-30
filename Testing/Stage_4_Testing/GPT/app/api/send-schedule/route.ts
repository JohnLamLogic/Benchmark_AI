import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { normalizeWeekStart } from '@/lib/helpers';
import { buildSchedulePdf } from '@/lib/schedulePdf';
import { sendScheduleEmail } from '@/lib/gmail';

export async function POST(req: NextRequest) {
  const { weekStart } = await req.json();
  if (!weekStart) {
    return NextResponse.json({ error: 'weekStart is required.' }, { status: 400 });
  }

  const normalizedWeek = normalizeWeekStart(weekStart);
  const schedule = db.prepare('SELECT * FROM schedules WHERE week_start = ?').get(normalizedWeek);
  if (!schedule) {
    return NextResponse.json({ error: 'Schedule not found.' }, { status: 404 });
  }

  const shifts = db
    .prepare(
      `SELECT shifts.*, employees.name AS employee_name
       FROM shifts
       JOIN employees ON employees.id = shifts.employee_id
       WHERE shifts.schedule_id = ?
       ORDER BY shifts.day, shifts.start_time`
    )
    .all(schedule.id)
    .map((row) => ({
      id: row.id,
      scheduleId: row.schedule_id,
      employeeId: row.employee_id,
      day: row.day,
      startTime: row.start_time,
      endTime: row.end_time,
      position: row.position,
      employeeName: row.employee_name
    }));

  const employees = db
    .prepare('SELECT * FROM employees ORDER BY name')
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      positions: JSON.parse(row.positions),
      payRate: row.pay_rate,
      createdAt: row.created_at
    }));

  const pdfBuffer = await buildSchedulePdf(shifts, employees, normalizedWeek);

  const errors: string[] = [];
  for (const employee of employees) {
    try {
      await sendScheduleEmail(employee.email, employee.name, normalizedWeek, pdfBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error when emailing ' + employee.email;
      errors.push(employee.email + ': ' + message);
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    errors
  });
}
