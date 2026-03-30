import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get('employeeId');
  let query = `SELECT tor.*, employees.name AS employee_name FROM time_off_requests tor
    JOIN employees ON employees.id = tor.employee_id`;
  const params: Array<string | number> = [];
  if (employeeId) {
    query += ' WHERE tor.employee_id = ?';
    params.push(Number(employeeId));
  }
  query += ' ORDER BY tor.created_at DESC';
  const data = db.prepare(query).all(...params);
  const requests = data.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    date: row.date,
    reason: row.reason,
    status: row.status,
    managerNotes: row.manager_notes,
    respondedAt: row.responded_at,
    createdAt: row.created_at
  }));
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const { employeeId, date, reason } = await req.json();
  if (!employeeId || !date || !reason) {
    return NextResponse.json({ error: 'employeeId, date, and reason are required.' }, { status: 400 });
  }
  const info = db
    .prepare('INSERT INTO time_off_requests (employee_id, date, reason) VALUES (?, ?, ?)')
    .run(employeeId, date, reason);
  const row = db
    .prepare(
      `SELECT tor.*, employees.name
       FROM time_off_requests tor
       JOIN employees ON employees.id = tor.employee_id
       WHERE tor.id = ?`
    )
    .get(info.lastInsertRowid);
  return NextResponse.json({
    request: {
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.name,
      date: row.date,
      reason: row.reason,
      status: row.status,
      managerNotes: row.manager_notes,
      respondedAt: row.responded_at,
      createdAt: row.created_at
    }
  });
}
