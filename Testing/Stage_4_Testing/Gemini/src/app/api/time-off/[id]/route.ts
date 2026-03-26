import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body // 'approved' or 'denied'

    const timeOffRequest = await prisma.timeOffRequest.update({
      where: { id },
      data: { status },
      include: { employee: true }
    })
    
    // We would trigger an email notification here based on instructions
    // if employee email is valid and status changed to approved/denied.
    // For now, API handles DB update.
    
    return NextResponse.json(timeOffRequest)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update time off request' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.timeOffRequest.delete({
      where: { id },
    })
    
    return NextResponse.json({ message: 'Request deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 })
  }
}
