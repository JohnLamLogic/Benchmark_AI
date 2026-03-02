import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const { pdfBase64, weekStartDate } = json;

        const cookieStore = await cookies();
        const refreshToken = cookieStore.get('gmail_refresh_token')?.value;
        const accessToken = cookieStore.get('gmail_access_token')?.value;

        if (!refreshToken && !accessToken) {
            return NextResponse.json({ error: 'Not authenticated with Gmail' }, { status: 401 });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback/google`
        );

        oauth2Client.setCredentials({
            refresh_token: refreshToken,
            access_token: accessToken
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const employees = await prisma.employee.findMany();
        let sentCount = 0;

        for (const emp of employees) {
            if (!emp.email) continue;

            const subject = `Weekly Schedule - Week of ${weekStartDate}`;
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const pdfData = pdfBase64.split('base64,')[1];

            const messageParts = [
                `To: ${emp.email}`,
                `Subject: ${utf8Subject}`,
                'MIME-Version: 1.0',
                'Content-Type: multipart/mixed; boundary="boundary_gmail_x"',
                '',
                '--boundary_gmail_x',
                'Content-Type: text/plain; charset="utf-8"',
                'Content-Transfer-Encoding: 7bit',
                '',
                `Hello ${emp.name},\n\nPlease find the attached schedule for the week of ${weekStartDate}.`,
                '',
                '--boundary_gmail_x',
                'Content-Type: application/pdf; name="Schedule.pdf"',
                'Content-Transfer-Encoding: base64',
                'Content-Disposition: attachment; filename="Schedule.pdf"',
                '',
                pdfData,
                '--boundary_gmail_x--',
                ''
            ];

            const message = messageParts.join('\n');
            const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

            await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                },
            });
            sentCount++;
        }

        return NextResponse.json({ success: true, sent: sentCount });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
    }
}
