const express = require('express');
const router = express.Router();
const { schedules, shifts, employees, gmailTokens } = require('../db/store');
const { getAuthUrl, getTokensFromCode, sendScheduleEmail } = require('../utils/gmail');
const { generateSchedulePDF } = require('../utils/pdf');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}
function requireManager(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.session.user.role !== 'manager') return res.status(403).json({ error: 'Manager access required' });
  next();
}

router.get('/oauth/url', requireManager, (req, res) => {
  try { return res.json({ url: getAuthUrl() }); }
  catch (err) { return res.status(500).json({ error: 'Failed to generate OAuth URL', message: err.message }); }
});

router.get('/oauth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect('/#settings?oauth=error&message=' + encodeURIComponent(error));
  if (!code) return res.redirect('/#settings?oauth=error&message=No+authorization+code+received');
  try {
    const tokens = await getTokensFromCode(code);
    gmailTokens.set({ access_token: tokens.access_token || null, refresh_token: tokens.refresh_token || null, token_type: tokens.token_type || 'Bearer', expiry_date: tokens.expiry_date || null });
    return res.redirect('/#settings?oauth=success');
  } catch (err) {
    return res.redirect('/#settings?oauth=error&message=' + encodeURIComponent(err.message));
  }
});

router.get('/status', requireManager, (req, res) => {
  const tokens = gmailTokens.get();
  if (!tokens || !tokens.refresh_token) return res.json({ connected: false });
  if (tokens.expiry_date && tokens.expiry_date < Date.now() && !tokens.refresh_token) return res.json({ connected: false, reason: 'Token expired' });
  return res.json({ connected: true });
});

router.get('/pdf/:week_start', requireAuth, async (req, res) => {
  const { week_start } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) return res.status(400).json({ error: 'Invalid week_start format' });
  const schedule = schedules.findOne(s => s.week_start === week_start);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found for this week' });
  const empMap = {};
  employees.findAll().forEach(e => { empMap[e.id] = e; });
  const enrichedShifts = shifts.findAll(s => s.schedule_id === schedule.id)
    .map(s => ({ ...s, employee_name: empMap[s.employee_id]?.name || 'Unknown', employee_email: empMap[s.employee_id]?.email || '' }))
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
  try {
    const pdfBuffer = await generateSchedulePDF(week_start, enrichedShifts, employees.findAll());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="schedule-${week_start}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate PDF', message: err.message });
  }
});

router.post('/send', requireManager, async (req, res) => {
  const { week_start } = req.body;
  if (!week_start || !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) return res.status(400).json({ error: 'Valid week_start is required' });
  const tokens = gmailTokens.get();
  if (!tokens || !tokens.refresh_token) return res.status(400).json({ error: 'Gmail is not connected. Please connect Gmail first.' });
  const schedule = schedules.findOne(s => s.week_start === week_start);
  if (!schedule) return res.status(404).json({ error: 'No schedule found for this week' });
  const allShifts = shifts.findAll(s => s.schedule_id === schedule.id);
  if (allShifts.length === 0) return res.status(400).json({ error: 'No shifts found for this week' });
  const allEmployees = employees.findAll();
  const empMap = {};
  allEmployees.forEach(e => { empMap[e.id] = e; });
  const enrichedShifts = allShifts.map(s => ({ ...s, employee_name: empMap[s.employee_id]?.name || 'Unknown', employee_email: empMap[s.employee_id]?.email || '' }));
  try {
    const pdfBuffer = await generateSchedulePDF(week_start, enrichedShifts, allEmployees);
    const empIdsWithShifts = [...new Set(allShifts.map(s => s.employee_id))];
    const empWithShifts = allEmployees.filter(e => empIdsWithShifts.includes(e.id));
    const results = [], errors = [];
    for (const emp of empWithShifts) {
      try { await sendScheduleEmail(emp.email, emp.name, pdfBuffer, week_start); results.push({ employee: emp.name, email: emp.email, status: 'sent' }); }
      catch (err) { errors.push({ employee: emp.name, email: emp.email, error: err.message }); }
    }
    return res.json({ success: true, sent: results, errors, message: `Schedule sent to ${results.length} employee(s)${errors.length > 0 ? `, ${errors.length} failed` : ''}` });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send emails', message: err.message });
  }
});

router.delete('/disconnect', requireManager, (req, res) => {
  gmailTokens.clear();
  return res.json({ success: true, message: 'Gmail disconnected successfully' });
});

module.exports = router;
