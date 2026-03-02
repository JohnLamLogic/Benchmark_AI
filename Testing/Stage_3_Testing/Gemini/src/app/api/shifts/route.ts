export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const shift = await prisma.shift.create({
            data: {
                employeeId: json.employeeId,
                weekId: json.weekId,
                dayOfWeek: json.dayOfWeek,
                startTime: json.startTime,
                endTime: json.endTime,
                position: json.position
            }
        });
        return NextResponse.json(shift, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 });
    }
}
