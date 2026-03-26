import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const weekIdentifier = searchParams.get('weekIdentifier')
    
    let shifts = []
    if (weekIdentifier) {
      shifts = await prisma.shift.findMany({
        where: { weekIdentifier },
        include: { employee: true }
      })
    } else {
      shifts = await prisma.shift.findMany({
        include: { employee: true }
      })
    }
    
    return NextResponse.json(shifts)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { date, startTime, endTime, position, weekIdentifier, employeeId } = body
    
    const shift = await prisma.shift.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        position,
        weekIdentifier,
        employeeId,
      },
      include: { employee: true }
    })
    
    return NextResponse.json(shift)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
  }
}
