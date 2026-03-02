const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN_PATH = path.join(__dirname, 'tokens.json');

const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/gmail/callback'
);

// Load saved tokens on startup
if (fs.existsSync(TOKEN_PATH)) {
    try {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        oauth2Client.setCredentials(tokens);
    } catch (e) {
        console.warn('Could not load Gmail tokens:', e.message);
    }
}

// Auto-save refreshed tokens
oauth2Client.on('tokens', (tokens) => {
    const existing = fs.existsSync(TOKEN_PATH)
        ? JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
        : {};
    const merged = { ...existing, ...tokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
});

function getAuthUrl() {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/gmail.send'],
    });
}

async function handleCallback(code) {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    return tokens;
}

function isAuthorized() {
    const creds = oauth2Client.credentials;
    return !!(creds && (creds.access_token || creds.refresh_token));
}

async function sendEmail(toEmail, toName, subject, pdfBuffer, weekLabel) {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const pdfBase64 = pdfBuffer.toString('base64');
    const boundary = 'email_boundary_xyz123';

    const rawMessage = [
        `To: ${toName} <${toEmail}>`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        '',
        `Hi ${toName},\n\nPlease find your schedule for ${weekLabel} attached.\n\nThank you!`,
        '',
        `--${boundary}`,
        'Content-Type: application/pdf',
        `Content-Disposition: attachment; filename="schedule_${weekLabel}.pdf"`,
        'Content-Transfer-Encoding: base64',
        '',
        pdfBase64,
        `--${boundary}--`,
    ].join('\r\n');

    const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
    });
}

module.exports = { getAuthUrl, handleCallback, isAuthorized, sendEmail };
