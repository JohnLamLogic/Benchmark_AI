import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sendTimeOffDecisionEmail } from '@/lib/gmail';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await context.params;
  const decisionId = Number(resolvedParams.id);
  const { status, managerNotes } = await req.json();
  if (status !== 'approved' && status !== 'denied') {
    return NextResponse.json({ error: 'Status must be approved or denied.' }, { status: 400 });
  }

  const requestRow = db
    .prepare(
      `SELECT tor.*, employees.name AS employee_name, employees.email
       FROM time_off_requests tor
       JOIN employees ON employees.id = tor.employee_id
       WHERE tor.id = ?`
    )
    .get(decisionId);
  if (!requestRow) {
    return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  }

  db.prepare('UPDATE time_off_requests SET status = ?, manager_notes = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    status,
    managerNotes || null,
    decisionId
  );

  await sendTimeOffDecisionEmail(requestRow.email, requestRow.employee_name, status, requestRow.reason);

  const updated = db
    .prepare(
      `SELECT tor.*, employees.name AS employee_name
       FROM time_off_requests tor
       JOIN employees ON employees.id = tor.employee_id
       WHERE tor.id = ?`
    )
    .get(decisionId);

  return NextResponse.json({
    request: {
      id: updated.id,
      employeeId: updated.employee_id,
      employeeName: updated.employee_name,
      date: updated.date,
      reason: updated.reason,
      status: updated.status,
      managerNotes: updated.manager_notes,
      respondedAt: updated.responded_at,
      createdAt: updated.created_at
    }
  });
}
