const GMAIL_BASE_URL = process.env.GMAIL_API_BASE_URL ?? 'https://gmail.googleapis.com';

interface GmailSendOptions {
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{ filename: string; mimeType: string; content: Buffer }>;
}

function base64UrlEncode(unencoded: Buffer | string) {
  return Buffer.from(unencoded)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function refreshAccessToken() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Gmail OAuth credentials in environment variables.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error('Unable to refresh Gmail access token: ' + payload);
  }

  const json = await response.json();
  if (!json.access_token) {
    throw new Error('Gmail refresh response did not include an access token.');
  }

  return json.access_token as string;
}

async function sendRawMessage(options: GmailSendOptions) {
  const sender = process.env.GMAIL_SENDER_EMAIL;
  if (!sender) {
    throw new Error('Please provide GMAIL_SENDER_EMAIL in your environment.');
  }

  const boundary = '----shiftwise-' + Date.now();
  const parts: string[] = [];

  parts.push('From: ' + sender);
  parts.push('To: ' + options.to);
  parts.push('Subject: ' + options.subject);
  parts.push('MIME-Version: 1.0');
  parts.push('Content-Type: multipart/mixed; boundary=' + boundary);
  parts.push('');
  parts.push('--' + boundary);
  parts.push('Content-Type: text/plain; charset="UTF-8"');
  parts.push('Content-Transfer-Encoding: 7bit');
  parts.push('');
  parts.push(options.body);

  if (options.attachments?.length) {
    for (const attachment of options.attachments) {
      parts.push('');
      parts.push('--' + boundary);
      parts.push('Content-Type: ' + attachment.mimeType + '; name="' + attachment.filename + '"');
      parts.push('Content-Transfer-Encoding: base64');
      parts.push(
        'Content-Disposition: attachment; filename="' + attachment.filename + '"; size=' + attachment.content.length
      );
      parts.push('');
      parts.push(attachment.content.toString('base64'));
    }
  }

  parts.push('');
  parts.push('--' + boundary + '--');

  const raw = base64UrlEncode(parts.join('\r\n'));
  const accessToken = await refreshAccessToken();

  const response = await fetch(GMAIL_BASE_URL + '/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error('Gmail send failed: ' + payload);
  }
}

export async function sendScheduleEmail(to: string, employeeName: string, weekStart: string, pdf: Buffer) {
  const body =
    'Hi ' +
    employeeName +
    ',\n\nPlease find attached the schedule for the week beginning ' +
    weekStart +
    '.\nLet me know if you have any questions.\n\nBest,\nShiftwise Scheduler';

  await sendRawMessage({
    to,
    subject: 'Weekly Schedule  ' + weekStart,
    body,
    attachments: [
      {
        filename: 'shiftwise-schedule-' + weekStart + '.pdf',
        mimeType: 'application/pdf',
        content: pdf
      }
    ]
  });
}

export async function sendTimeOffDecisionEmail(
  to: string,
  employeeName: string,
  status: 'approved' | 'denied',
  reason: string,
  weekStart?: string
) {
  const body =
    'Hi ' +
    employeeName +
    ',\n\nYour time-off request for ' +
    reason +
    ' has been ' +
    status +
    '.\n' +
    (weekStart ? 'Related week: ' + weekStart + '.\n' : '') +
    '\nBest,\nShiftwise Scheduler';

  await sendRawMessage({
    to,
    subject: 'Time-off request ' + status,
    body
  });
}
