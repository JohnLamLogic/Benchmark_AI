const express = require('express');
const router = express.Router();
const { timeoff, employees } = require('../db/store');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}
function requireManager(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.session.user.role !== 'manager') return res.status(403).json({ error: 'Manager access required' });
  next();
}

function enrich(request) {
  const emp = employees.findById(request.employee_id);
  return { ...request, employee_name: emp?.name || 'Unknown', employee_email: emp?.email || '' };
}

router.get('/', requireAuth, (req, res) => {
  if (req.session.user.role === 'manager') {
    return res.json(timeoff.findAll().map(enrich).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }
  const empId = req.session.user.employee_id;
  if (!empId) return res.status(400).json({ error: 'No employee profile associated' });
  return res.json(timeoff.findAll(t => t.employee_id === empId).map(enrich).sort((a, b) => b.created_at.localeCompare(a.created_at)));
});

router.post('/', requireAuth, (req, res) => {
  const { request_date, reason } = req.body;
  if (!request_date || !reason) return res.status(400).json({ error: 'request_date and reason are required' });
  const empId = req.session.user.employee_id;
  if (!empId) return res.status(400).json({ error: 'No employee profile associated' });
  return res.status(201).json(enrich(timeoff.insert({ employee_id: empId, request_date, reason, status: 'pending', manager_notes: '' })));
});

router.put('/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  const { status, manager_notes } = req.body;
  if (!['approved', 'denied'].includes(status)) return res.status(400).json({ error: 'status must be "approved" or "denied"' });
  const request = timeoff.findById(id);
  if (!request) return res.status(404).json({ error: 'Time off request not found' });
  const updated = timeoff.update(id, { status, manager_notes: manager_notes || '' });
  const enriched = enrich(updated);
  try {
    const { sendTimeOffNotification } = require('../utils/gmail');
    await sendTimeOffNotification(enriched.employee_email, enriched.employee_name, status, request.request_date, manager_notes || '');
  } catch (err) {
    console.warn('Failed to send time-off notification email:', err.message);
  }
  return res.json(enriched);
});

module.exports = router;
