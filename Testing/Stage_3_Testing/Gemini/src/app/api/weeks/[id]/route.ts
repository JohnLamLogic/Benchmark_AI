export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const week = await prisma.week.findUnique({
            where: { id: parseInt(id) },
            include: { shifts: true }
        });
        return NextResponse.json(week);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch week' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.week.delete({
            where: { id: parseInt(id) }
        });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete week' }, { status: 500 });
    }
}
