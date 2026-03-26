const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { getAuthUrl, getTokensFromCode, getOAuthClient, sendScheduleEmail } = require('../utils/gmail');
const { generateSchedulePDF } = require('../utils/pdf');

// Middleware: require authentication
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Middleware: require manager role
function requireManager(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.session.user.role !== 'manager') {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
}

// GET /api/email/oauth/url - manager only: get OAuth URL
router.get('/oauth/url', requireManager, (req, res) => {
  try {
    const url = getAuthUrl();
    return res.json({ url });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate OAuth URL', message: err.message });
  }
});

// GET /api/email/oauth/callback - OAuth callback handler
router.get('/oauth/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/#settings?oauth=error&message=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.redirect('/#settings?oauth=error&message=No+authorization+code+received');
  }

  try {
    const tokens = await getTokensFromCode(code);

    // Store tokens in DB
    const existing = db.prepare('SELECT id FROM gmail_tokens WHERE id = 1').get();
    if (existing) {
      db.prepare(`
        UPDATE gmail_tokens
        SET access_token = ?, refresh_token = ?, token_type = ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(
        tokens.access_token || null,
        tokens.refresh_token || null,
        tokens.token_type || 'Bearer',
        tokens.expiry_date || null
      );
    } else {
      db.prepare(`
        INSERT INTO gmail_tokens (id, access_token, refresh_token, token_type, expiry_date)
        VALUES (1, ?, ?, ?, ?)
      `).run(
        tokens.access_token || null,
        tokens.refresh_token || null,
        tokens.token_type || 'Bearer',
        tokens.expiry_date || null
      );
    }

    return res.redirect('/#settings?oauth=success');
  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.redirect('/#settings?oauth=error&message=' + encodeURIComponent(err.message));
  }
});

// GET /api/email/status - manager only: connection status
router.get('/status', requireManager, (req, res) => {
  const tokens = db.prepare('SELECT * FROM gmail_tokens WHERE id = 1').get();

  if (!tokens || !tokens.refresh_token) {
    return res.json({ connected: false });
  }

  // Check if token is expired (and no refresh token)
  const now = Date.now();
  const isExpired = tokens.expiry_date && tokens.expiry_date < now;

  if (isExpired && !tokens.refresh_token) {
    return res.json({ connected: false, reason: 'Token expired' });
  }

  return res.json({ connected: true });
});

// GET /api/email/pdf/:week_start - generate and download PDF for a week
router.get('/pdf/:week_start', requireAuth, async (req, res) => {
  const { week_start } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
    return res.status(400).json({ error: 'Invalid week_start format' });
  }

  const schedule = db.prepare('SELECT * FROM schedules WHERE week_start = ?').get(week_start);
  if (!schedule) {
    return res.status(404).json({ error: 'Schedule not found for this week' });
  }

  const shifts = db.prepare(`
    SELECT s.*, e.name as employee_name, e.email as employee_email
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id = ?
    ORDER BY s.day_of_week ASC, s.start_time ASC
  `).all(schedule.id);

  const employees = db.prepare('SELECT * FROM employees ORDER BY name ASC').all();

  try {
    const pdfBuffer = await generateSchedulePDF(week_start, shifts, employees);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="schedule-${week_start}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    return res.status(500).json({ error: 'Failed to generate PDF', message: err.message });
  }
});

// POST /api/email/send - manager only: send schedule PDF to all employees
router.post('/send', requireManager, async (req, res) => {
  const { week_start } = req.body;

  if (!week_start || !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
    return res.status(400).json({ error: 'Valid week_start is required' });
  }

  // Check Gmail is connected
  const tokens = db.prepare('SELECT * FROM gmail_tokens WHERE id = 1').get();
  if (!tokens || !tokens.refresh_token) {
    return res.status(400).json({ error: 'Gmail is not connected. Please connect Gmail first.' });
  }

  const schedule = db.prepare('SELECT * FROM schedules WHERE week_start = ?').get(week_start);
  if (!schedule) {
    return res.status(404).json({ error: 'No schedule found for this week' });
  }

  const shifts = db.prepare(`
    SELECT s.*, e.name as employee_name, e.email as employee_email
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id = ?
    ORDER BY s.day_of_week ASC, s.start_time ASC
  `).all(schedule.id);

  if (shifts.length === 0) {
    return res.status(400).json({ error: 'No shifts found for this week' });
  }

  const employees = db.prepare('SELECT * FROM employees ORDER BY name ASC').all();

  try {
    // Generate PDF
    const pdfBuffer = await generateSchedulePDF(week_start, shifts, employees);

    // Get unique employees who have shifts this week
    const employeeIdsWithShifts = [...new Set(shifts.map(s => s.employee_id))];
    const employeesWithShifts = employees.filter(e => employeeIdsWithShifts.includes(e.id));

    const results = [];
    const errors = [];

    for (const employee of employeesWithShifts) {
      try {
        await sendScheduleEmail(employee.email, employee.name, pdfBuffer, week_start);
        results.push({ employee: employee.name, email: employee.email, status: 'sent' });
      } catch (err) {
        errors.push({ employee: employee.name, email: employee.email, error: err.message });
      }
    }

    return res.json({
      success: true,
      sent: results,
      errors,
      message: `Schedule sent to ${results.length} employee(s)${errors.length > 0 ? `, ${errors.length} failed` : ''}`
    });
  } catch (err) {
    console.error('Send email error:', err);
    return res.status(500).json({ error: 'Failed to send emails', message: err.message });
  }
});

// DELETE /api/email/disconnect - manager only: clear Gmail tokens
router.delete('/disconnect', requireManager, (req, res) => {
  db.prepare('DELETE FROM gmail_tokens WHERE id = 1').run();
  return res.json({ success: true, message: 'Gmail disconnected successfully' });
});

module.exports = router;
