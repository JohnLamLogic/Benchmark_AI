import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const employees = await prisma.employee.findMany()
    return NextResponse.json(employees)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, payRate, isManager, positions } = body
    
    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        payRate: parseFloat(payRate),
        isManager: isManager || false,
        positions: positions || '',
      },
    })
    
    return NextResponse.json(employee)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
