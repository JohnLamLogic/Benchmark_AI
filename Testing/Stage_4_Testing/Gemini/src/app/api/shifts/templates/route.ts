import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const shifts = await prisma.shift.findMany({
      where: { weekIdentifier: { startsWith: 'SAVED:' } },
      select: { weekIdentifier: true },
    })
    const uniqueTemplates = Array.from(new Set(shifts.map((s: any) => s.weekIdentifier)))
    return NextResponse.json(uniqueTemplates)
  } catch(error) {
    console.error('Template list error', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { currentWeek, templateId } = await request.json()
    const shifts = await prisma.shift.findMany({ where: { weekIdentifier: currentWeek } })
    
    await prisma.shift.deleteMany({ where: { weekIdentifier: templateId } })

    const templateShifts = shifts.map((s: any) => ({
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      position: s.position,
      employeeId: s.employeeId,
      weekIdentifier: templateId
    }))

    if (templateShifts.length > 0) {
      await prisma.shift.createMany({ data: templateShifts })
    }
    
    return NextResponse.json({ success: true })
  } catch(error) {
    console.error('Template save error', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { templateId, targetWeek } = await request.json()
    const shifts = await prisma.shift.findMany({ where: { weekIdentifier: templateId } })
    
    const newShifts = shifts.map((s: any) => ({
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      position: s.position,
      employeeId: s.employeeId,
      weekIdentifier: targetWeek
    }))

    if (newShifts.length > 0) {
      await prisma.shift.createMany({ data: newShifts })
    }
    
    return NextResponse.json({ success: true })
  } catch(error) {
    console.error('Template load error', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
