import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await context.params;
  const id = Number(resolvedParams.id);
  const body = await req.json();
  const { name, email, positions, payRate } = body;
  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
  }
  try {
    db.prepare('UPDATE employees SET name = ?, email = ?, positions = ?, pay_rate = ? WHERE id = ?').run(
      name.trim(),
      email.trim(),
      JSON.stringify(Array.isArray(positions) ? positions : []),
      typeof payRate === 'number' ? payRate : 0,
      id
    );
    const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!row) {
      return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    }
    const employee = {
      id: row.id,
      name: row.name,
      email: row.email,
      positions: JSON.parse(row.positions),
      payRate: row.pay_rate,
      createdAt: row.created_at
    };
    return NextResponse.json({ employee });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to update employee.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await context.params;
  const id = Number(resolvedParams.id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
