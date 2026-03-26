import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const requests = await prisma.timeOffRequest.findMany({
      include: { employee: true },
      orderBy: { date: 'desc' }
    })
    return NextResponse.json(requests)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch time off requests' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { date, reason, employeeId } = body
    
    const timeOffRequest = await prisma.timeOffRequest.create({
      data: {
        date: new Date(date),
        reason,
        employeeId,
      },
      include: { employee: true }
    })
    
    return NextResponse.json(timeOffRequest)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create time off request' }, { status: 500 })
  }
}
