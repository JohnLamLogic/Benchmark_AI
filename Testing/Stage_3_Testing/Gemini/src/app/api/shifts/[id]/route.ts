export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const json = await request.json();
        const shift = await prisma.shift.update({
            where: { id: parseInt(id) },
            data: {
                startTime: json.startTime,
                endTime: json.endTime,
                position: json.position
            }
        });
        return NextResponse.json(shift);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.shift.delete({
            where: { id: parseInt(id) }
        });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 });
    }
}
