import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, email, payRate, isManager, positions } = body

    const employee = await prisma.employee.update({
      where: { id },
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
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.employee.delete({
      where: { id },
    })
    
    return NextResponse.json({ message: 'Employee deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
  }
}
