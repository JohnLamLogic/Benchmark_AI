import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { google } from 'googleapis'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { to, subject, text, pdfBase64, filename } = body

    const clientId = process.env.GMAIL_CLIENT_ID
    const clientSecret = process.env.GMAIL_CLIENT_SECRET
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN
    const userEmail = process.env.MANAGER_EMAIL

    if (!clientId || !clientSecret || !refreshToken || !userEmail) {
      return NextResponse.json({ error: 'Gmail credentials not fully configured in .env' }, { status: 400 })
    }

    const OAuth2 = google.auth.OAuth2
    const oauth2Client = new OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground')
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const accessTokenRes = await oauth2Client.getAccessToken()
    const accessToken = accessTokenRes.token

    if (!accessToken) throw new Error('Failed to create access token')

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: userEmail,
        clientId,
        clientSecret,
        refreshToken,
        accessToken,
      },
    })

    const attachments = []
    if (pdfBase64) {
      attachments.push({
        filename: filename || 'schedule.pdf',
        content: pdfBase64.split('base64,')[1] || pdfBase64,
        encoding: 'base64'
      })
    }

    const mailOptions = {
      from: userEmail,
      to,
      subject,
      text,
      attachments
    }

    const result = await transporter.sendMail(mailOptions)
    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (error: any) {
    console.error('Email send error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 })
  }
}
