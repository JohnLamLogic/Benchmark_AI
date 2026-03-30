import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { normalizeWeekStart } from '@/lib/helpers';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sourceWeek, targetWeek } = body;
  if (!sourceWeek || !targetWeek) {
    return NextResponse.json({ error: 'sourceWeek and targetWeek are required.' }, { status: 400 });
  }

  const sourceWeekStart = normalizeWeekStart(sourceWeek);
  const targetWeekStart = normalizeWeekStart(targetWeek);

  const source = db.prepare('SELECT * FROM schedules WHERE week_start = ?').get(sourceWeekStart);
  if (!source) {
    return NextResponse.json({ error: 'Source schedule not found.' }, { status: 404 });
  }

  const target = db.prepare('SELECT * FROM schedules WHERE week_start = ?').get(targetWeekStart);
  let targetId: number;

  if (target) {
    targetId = target.id;
  } else {
    const info = db.prepare('INSERT INTO schedules (week_start) VALUES (?)').run(targetWeekStart);
    targetId = Number(info.lastInsertRowid);
  }

  const shifts = db.prepare('SELECT * FROM shifts WHERE schedule_id = ?').all(source.id);

  const insert = db.prepare(
    'INSERT INTO shifts (schedule_id, employee_id, day, start_time, end_time, position) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM shifts WHERE schedule_id = ?').run(targetId);
    for (const shift of shifts) {
      insert.run(targetId, shift.employee_id, shift.day, shift.start_time, shift.end_time, shift.position);
    }
  });
  transaction();

  return NextResponse.json({ success: true });
}
