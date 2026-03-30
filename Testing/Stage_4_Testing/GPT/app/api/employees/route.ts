import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

interface CreateEmployeeBody {
  name: string;
  email: string;
  positions: string[];
  payRate: number;
}

export async function GET() {
  const rows = db.prepare('SELECT * FROM employees ORDER BY name').all();
  const employees = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    positions: JSON.parse(row.positions),
    payRate: row.pay_rate,
    createdAt: row.created_at
  }));
  return NextResponse.json({ employees });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateEmployeeBody;
  if (!body.name || !body.email) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
  }
  const positions = Array.isArray(body.positions) ? body.positions : [];
  const payRate = typeof body.payRate === 'number' ? body.payRate : 0;

  try {
    const info = db
      .prepare('INSERT INTO employees (name, email, positions, pay_rate) VALUES (?, ?, ?, ?)')
      .run(body.name.trim(), body.email.trim(), JSON.stringify(positions), payRate);
    const employee = {
      id: Number(info.lastInsertRowid),
      name: body.name.trim(),
      email: body.email.trim(),
      positions,
      payRate,
      createdAt: new Date().toISOString()
    };
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to create employee.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
