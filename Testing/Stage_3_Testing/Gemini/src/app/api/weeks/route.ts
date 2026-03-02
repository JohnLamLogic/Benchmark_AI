export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        if (date) {
            const week = await prisma.week.findFirst({
                where: { start_date: date },
                include: { shifts: true }
            });
            return NextResponse.json(week || null);
        }
        const weeks = await prisma.week.findMany();
        return NextResponse.json(weeks);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch weeks' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const json = await request.json();
        let week = await prisma.week.findFirst({
            where: { start_date: json.start_date },
        });

        if (!week) {
            week = await prisma.week.create({
                data: { start_date: json.start_date }
            });
        }

        if (json.shifts && Array.isArray(json.shifts)) {
            await prisma.shift.deleteMany({
                where: { weekId: week.id }
            });

            const shiftsData = json.shifts.map((s: any) => ({
                employeeId: s.employeeId,
                weekId: week?.id,
                dayOfWeek: s.dayOfWeek,
                startTime: s.startTime,
                endTime: s.endTime,
                position: s.position
            }));

            if (shiftsData.length > 0) {
                await prisma.shift.createMany({ data: shiftsData });
            }
        }

        return NextResponse.json(week, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to save week' }, { status: 500 });
    }
}

