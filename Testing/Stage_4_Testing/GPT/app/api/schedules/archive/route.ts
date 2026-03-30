import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  const weeks = db
    .prepare('SELECT id, week_start, created_at FROM schedules ORDER BY week_start DESC')
    .all()
    .map((row) => ({
      id: row.id,
      weekStart: row.week_start,
      createdAt: row.created_at
    }));
  return NextResponse.json({ weeks });
}
