const { google } = require('googleapis');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground';
const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL;

const ensureConfig = () => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !SENDER_EMAIL) {
    throw new Error('Missing Gmail configuration. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_SENDER_EMAIL.');
  }
};

const oauth2Client = () => {
  ensureConfig();
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  auth.setCredentials({ refresh_token: REFRESH_TOKEN });
  return auth;
};

const base64UrlEncode = (buffer) =>
  buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const buildWeekLabel = (weekStart) => {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
};

const buildMessage = (employee, weekStart, pdfBuffer) => {
  const boundary = 'schedule-boundary';
  const pdfBase64 = pdfBuffer.toString('base64');
  const weekLabel = buildWeekLabel(weekStart);
  const lines = [
    `From: ${SENDER_EMAIL}`,
    `To: ${employee.email}`,
    `Subject: Weekly schedule for ${weekLabel}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary=${boundary}`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    `Hi ${employee.name || 'team member'},`,
    '',
    `Attached is the weekly schedule for ${weekLabel}. Please reach out if you need to swap shifts or ask questions.`,
    '',
    `--${boundary}`,
    'Content-Type: application/pdf; name="schedule.pdf"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="schedule.pdf"',
    '',
    pdfBase64,
    `--${boundary}--`,
    ''
  ];

  return base64UrlEncode(Buffer.from(lines.join('\r\n')));
};

const sendScheduleEmails = async (weekStart, employees, pdfBuffer) => {
  const auth = oauth2Client();
  await auth.getAccessToken();
  const gmail = google.gmail({ version: 'v1', auth });
  const weekLabel = buildWeekLabel(weekStart);

  const results = [];
  for (const employee of employees) {
    if (!employee.email) {
      results.push({ email: null, skipped: true, name: employee.name });
      continue;
    }

    const rawMessage = buildMessage(employee, weekStart, pdfBuffer);
    try {
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: rawMessage
        }
      });
      results.push({ email: employee.email, skipped: false });
    } catch (error) {
      results.push({ email: employee.email, skipped: false, error: error.message });
    }
  }

  return {
    weekLabel,
    results
  };
};

module.exports = {
  sendScheduleEmails
};
