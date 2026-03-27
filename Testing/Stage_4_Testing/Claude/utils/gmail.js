require('dotenv').config();
const { google } = require('googleapis');
const { gmailTokens } = require('../db/store');

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

/**
 * Create and return an OAuth2 client configured from environment variables
 */
function getOAuthClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/email/oauth/callback';

  if (!clientId || !clientSecret || clientId === 'YOUR_GMAIL_CLIENT_ID_HERE') {
    throw new Error('Gmail OAuth credentials not configured. Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauth2Client;
}

/**
 * Get the Google OAuth authorization URL
 */
function getAuthUrl() {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to get refresh token
  });
  return url;
}

/**
 * Exchange authorization code for tokens
 */
async function getTokensFromCode(code) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Get an authenticated OAuth2 client with current tokens, refreshing if necessary
 */
async function getAuthenticatedClient() {
  const oauth2Client = getOAuthClient();
  const storedTokens = gmailTokens.get();

  if (!storedTokens || !storedTokens.refresh_token) {
    throw new Error('Gmail not connected. Please authorize Gmail access first.');
  }

  oauth2Client.setCredentials({
    access_token: storedTokens.access_token,
    refresh_token: storedTokens.refresh_token,
    token_type: storedTokens.token_type || 'Bearer',
    expiry_date: storedTokens.expiry_date
  });

  // Set up token refresh handler — persist updated tokens back to the store
  oauth2Client.on('tokens', (tokens) => {
    const current = gmailTokens.get() || {};
    gmailTokens.set({
      ...current,
      access_token: tokens.access_token || current.access_token,
      refresh_token: tokens.refresh_token || current.refresh_token,
      token_type: tokens.token_type || current.token_type || 'Bearer',
      expiry_date: tokens.expiry_date || current.expiry_date
    });
  });

  return oauth2Client;
}

/**
 * Format a date string "YYYY-MM-DD" to readable format
 */
function formatDateReadable(dateStr) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
}

/**
 * Encode a string to Base64URL (required by Gmail API)
 */
function toBase64Url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Build a raw MIME email with a PDF attachment
 */
function buildEmailWithAttachment(to, subject, htmlBody, pdfBuffer, filename) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2)}`;
  const pdfBase64 = pdfBuffer.toString('base64');

  const mimeLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    htmlBody,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${filename}"`,
    ``,
    pdfBase64,
    ``,
    `--${boundary}--`
  ];

  return toBase64Url(mimeLines.join('\r\n'));
}

/**
 * Build a plain MIME email (no attachments)
 */
function buildPlainEmail(to, subject, htmlBody) {
  const mimeLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    htmlBody
  ];

  return toBase64Url(mimeLines.join('\r\n'));
}

/**
 * Send schedule email to an employee with PDF attachment
 * @param {string} to - recipient email
 * @param {string} employeeName - employee's name
 * @param {Buffer} pdfBuffer - the PDF as a buffer
 * @param {string} weekStart - "YYYY-MM-DD" week start date
 */
async function sendScheduleEmail(to, employeeName, pdfBuffer, weekStart) {
  const auth = await getAuthenticatedClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const weekLabel = formatDateReadable(weekStart);
  const subject = `Your Schedule - Week of ${weekLabel}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #8B1A1A; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Weekly Schedule</h1>
      </div>
      <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
        <p>Hi <strong>${employeeName}</strong>,</p>
        <p>Your schedule for the week of <strong>${weekLabel}</strong> is attached as a PDF.</p>
        <p>Please review your shifts and contact your manager if you have any questions or concerns.</p>
        <br>
        <p style="color: #666; font-size: 13px;">This is an automated message from the Restaurant Scheduler system.</p>
      </div>
    </div>
  `;

  const rawEmail = buildEmailWithAttachment(
    to,
    subject,
    htmlBody,
    pdfBuffer,
    `schedule-${weekStart}.pdf`
  );

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawEmail }
  });
}

/**
 * Send time-off request decision notification to an employee
 * @param {string} to - recipient email
 * @param {string} employeeName - employee's name
 * @param {string} status - 'approved' or 'denied'
 * @param {string} requestDate - the date they requested off "YYYY-MM-DD"
 * @param {string} managerNotes - notes from the manager
 */
async function sendTimeOffNotification(to, employeeName, status, requestDate, managerNotes) {
  const auth = await getAuthenticatedClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const dateLabel = formatDateReadable(requestDate);
  const statusLabel = status === 'approved' ? 'Approved' : 'Denied';
  const statusColor = status === 'approved' ? '#2E7D32' : '#C62828';
  const statusBg = status === 'approved' ? '#E8F5E9' : '#FFEBEE';

  const subject = `Time Off Request ${statusLabel} - ${dateLabel}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #8B1A1A; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Time Off Request Update</h1>
      </div>
      <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
        <p>Hi <strong>${employeeName}</strong>,</p>
        <p>Your time off request for <strong>${dateLabel}</strong> has been reviewed.</p>

        <div style="background-color: ${statusBg}; border-left: 4px solid ${statusColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: ${statusColor}; font-size: 18px; font-weight: bold;">
            Status: ${statusLabel}
          </p>
        </div>

        ${managerNotes ? `
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 15px;">
          <p style="margin: 0 0 8px 0; font-weight: bold; color: #555;">Manager Notes:</p>
          <p style="margin: 0; color: #333;">${managerNotes}</p>
        </div>
        ` : ''}

        <p style="margin-top: 20px;">If you have any questions, please speak with your manager directly.</p>
        <br>
        <p style="color: #666; font-size: 13px;">This is an automated message from the Restaurant Scheduler system.</p>
      </div>
    </div>
  `;

  const rawEmail = buildPlainEmail(to, subject, htmlBody);

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: rawEmail }
  });
}

module.exports = {
  getOAuthClient,
  getAuthUrl,
  getTokensFromCode,
  sendScheduleEmail,
  sendTimeOffNotification
};
