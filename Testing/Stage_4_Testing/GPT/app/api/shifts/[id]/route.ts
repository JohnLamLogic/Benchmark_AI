import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await context.params;
  const shiftId = Number(resolvedParams.id);
  const { day, startTime, endTime, position } = await req.json();
  if (day === undefined || !startTime || !endTime || !position) {
    return NextResponse.json({ error: 'Day, startTime, endTime, and position are required.' }, { status: 400 });
  }
  db.prepare('UPDATE shifts SET day = ?, start_time = ?, end_time = ?, position = ? WHERE id = ?').run(
    day,
    startTime,
    endTime,
    position,
    shiftId
  );

  const row = db
    .prepare(
      `SELECT shifts.*, employees.name AS employee_name
       FROM shifts
       JOIN employees ON employees.id = shifts.employee_id
       WHERE shifts.id = ?`
    )
    .get(shiftId);

  if (!row) {
    return NextResponse.json({ error: 'Shift not found.' }, { status: 404 });
  }

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

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await context.params;
  const shiftId = Number(resolvedParams.id);
  db.prepare('DELETE FROM shifts WHERE id = ?').run(shiftId);
  return NextResponse.json({ success: true });
}
