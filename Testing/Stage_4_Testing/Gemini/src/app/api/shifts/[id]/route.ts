import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { startTime, endTime, position } = body

    const shift = await prisma.shift.update({
      where: { id },
      data: {
        startTime,
        endTime,
        position,
      },
      include: { employee: true }
    })
    
    return NextResponse.json(shift)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.shift.delete({
      where: { id },
    })
    
    return NextResponse.json({ message: 'Shift deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}
