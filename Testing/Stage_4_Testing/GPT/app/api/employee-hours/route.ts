import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { minutesBetween } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get('employeeId');
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required.' }, { status: 400 });
  }

  const rows = db
    .prepare(
      `SELECT schedules.week_start, shifts.start_time, shifts.end_time
       FROM shifts
       JOIN schedules ON schedules.id = shifts.schedule_id
       WHERE shifts.employee_id = ?
       ORDER BY schedules.week_start DESC`
    )
    .all(Number(employeeId));

  const byWeek: Record<string, number> = {};
  rows.forEach((row) => {
    const minutes = minutesBetween(row.start_time, row.end_time);
    if (!byWeek[row.week_start]) {
      byWeek[row.week_start] = 0;
    }
    byWeek[row.week_start] += minutes;
  });

  const summary = Object.entries(byWeek)
    .map(([weekStart, totalMinutes]) => ({
      weekStart,
      totalMinutes
    }))
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));

  return NextResponse.json({ summary });
}
