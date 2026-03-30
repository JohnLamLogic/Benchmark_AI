import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { normalizeWeekStart } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get('week');
  if (!week) {
    return NextResponse.json({ error: 'Query parameter week is required.' }, { status: 400 });
  }

  const weekStart = normalizeWeekStart(week);
  const schedule = db.prepare('SELECT * FROM schedules WHERE week_start = ?').get(weekStart);

  if (!schedule) {
    return NextResponse.json({ schedule: null, shifts: [] });
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

  return NextResponse.json({
    schedule: {
      id: schedule.id,
      weekStart: schedule.week_start,
      createdAt: schedule.created_at
    },
    shifts
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.weekStart) {
    return NextResponse.json({ error: 'weekStart is required.' }, { status: 400 });
  }
  const weekStart = normalizeWeekStart(body.weekStart);
  const existing = db.prepare('SELECT * FROM schedules WHERE week_start = ?').get(weekStart);
  if (existing) {
    return NextResponse.json({
      schedule: {
        id: existing.id,
        weekStart: existing.week_start,
        createdAt: existing.created_at
      }
    });
  }
  const info = db.prepare('INSERT INTO schedules (week_start) VALUES (?)').run(weekStart);
  return NextResponse.json({
    schedule: {
      id: Number(info.lastInsertRowid),
      weekStart,
      createdAt: new Date().toISOString()
    }
  });
}
