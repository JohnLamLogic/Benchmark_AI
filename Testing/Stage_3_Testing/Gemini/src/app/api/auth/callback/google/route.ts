import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.redirect(new URL('/?error=NoCode', request.url));
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback/google`
        );

        const { tokens } = await oauth2Client.getToken(code);

        const cookieStore = await cookies();
        if (tokens.refresh_token) {
            cookieStore.set('gmail_refresh_token', tokens.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 });
        }
        if (tokens.access_token) {
            cookieStore.set('gmail_access_token', tokens.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600 });
        }

        return NextResponse.redirect(new URL('/', request.url));
    } catch (error) {
        console.error('Auth error', error);
        return NextResponse.redirect(new URL('/?error=AuthFailed', request.url));
    }
}

export const dynamic = 'force-dynamic';
