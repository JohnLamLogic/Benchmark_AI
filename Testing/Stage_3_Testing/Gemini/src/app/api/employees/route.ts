export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const employees = await prisma.employee.findMany();
        return NextResponse.json(employees);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const employee = await prisma.employee.create({
            data: {
                name: json.name,
                email: json.email,
                positions: json.positions
            }
        });
        return NextResponse.json(employee, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create employee', details: String(error) }, { status: 500 });
    }
}

