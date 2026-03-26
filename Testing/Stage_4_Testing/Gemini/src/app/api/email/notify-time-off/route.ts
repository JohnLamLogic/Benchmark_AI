import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { google } from 'googleapis'
import prisma from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { employeeId, status, date } = body

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!employee || !employee.email) return NextResponse.json({ message: 'No email found' })

    const clientId = process.env.GMAIL_CLIENT_ID
    const clientSecret = process.env.GMAIL_CLIENT_SECRET
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN
    const userEmail = process.env.MANAGER_EMAIL

    if (!clientId || !clientSecret || !refreshToken || !userEmail) {
      console.warn('Email notification skipped, credentials missing.')
      return NextResponse.json({ message: 'Credentials missing' })
    }

    const OAuth2 = google.auth.OAuth2
    const oauth2Client = new OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground')
    oauth2Client.setCredentials({ refresh_token: refreshToken })
    const accessTokenRes = await oauth2Client.getAccessToken()
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: userEmail,
        clientId,
        clientSecret,
        refreshToken,
        accessToken: accessTokenRes.token || '',
      },
    })

    const dateStr = new Date(date).toLocaleDateString()
    
    await transporter.sendMail({
      from: userEmail,
      to: employee.email,
      subject: `Time Off Request ${status.toUpperCase()}`,
      text: `Your time off request for ${dateStr} has been ${status} by the manager.`
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Time off email error:', error)
    return NextResponse.json({ error: 'Failed to notify' }, { status: 500 })
  }
}
