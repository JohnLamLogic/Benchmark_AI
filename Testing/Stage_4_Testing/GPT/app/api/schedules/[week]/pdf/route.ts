import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { normalizeWeekStart } from '@/lib/helpers';
import { buildSchedulePdf } from '@/lib/schedulePdf';

export async function GET(_req: Request, context: { params: Promise<{ week: string }> | { week: string } }) {
  const resolvedParams = await context.params;
  const weekStart = normalizeWeekStart(resolvedParams.week);
  const schedule = db.prepare('SELECT * FROM schedules WHERE week_start = ?').get(weekStart);
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

  const pdfBuffer = await buildSchedulePdf(shifts, employees, weekStart);
  const response = new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="schedule-${weekStart}.pdf"`
    }
  });
  return response;
}
