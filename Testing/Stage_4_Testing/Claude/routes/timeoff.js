const express = require('express');
const router = express.Router();
const db = require('../db/database');

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

// GET /api/timeoff - manager gets all, employee gets their own
router.get('/', requireAuth, (req, res) => {
  if (req.session.user.role === 'manager') {
    const requests = db.prepare(`
      SELECT t.*, e.name as employee_name, e.email as employee_email
      FROM time_off_requests t
      JOIN employees e ON t.employee_id = e.id
      ORDER BY t.created_at DESC
    `).all();
    return res.json(requests);
  } else {
    // Employee: only their own requests
    const employeeId = req.session.user.employee_id;
    if (!employeeId) {
      return res.status(400).json({ error: 'No employee profile associated with this account' });
    }
    const requests = db.prepare(`
      SELECT t.*, e.name as employee_name
      FROM time_off_requests t
      JOIN employees e ON t.employee_id = e.id
      WHERE t.employee_id = ?
      ORDER BY t.created_at DESC
    `).all(employeeId);
    return res.json(requests);
  }
});

// POST /api/timeoff - authenticated employee creates request
router.post('/', requireAuth, (req, res) => {
  const { request_date, reason } = req.body;

  if (!request_date || !reason) {
    return res.status(400).json({ error: 'request_date and reason are required' });
  }

  let employeeId = req.session.user.employee_id;

  // If manager is creating on behalf (shouldn't normally happen, but handle gracefully)
  if (!employeeId) {
    return res.status(400).json({ error: 'No employee profile associated with this account' });
  }

  const result = db.prepare(
    "INSERT INTO time_off_requests (employee_id, request_date, reason, status) VALUES (?, ?, ?, 'pending')"
  ).run(employeeId, request_date, reason);

  const newRequest = db.prepare(`
    SELECT t.*, e.name as employee_name
    FROM time_off_requests t
    JOIN employees e ON t.employee_id = e.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  return res.status(201).json(newRequest);
});

// PUT /api/timeoff/:id - manager only: update status and notes
router.put('/:id', requireManager, async (req, res) => {
  const { id } = req.params;
  const { status, manager_notes } = req.body;

  if (!status || !['approved', 'denied'].includes(status)) {
    return res.status(400).json({ error: 'status must be "approved" or "denied"' });
  }

  const request = db.prepare(`
    SELECT t.*, e.name as employee_name, e.email as employee_email
    FROM time_off_requests t
    JOIN employees e ON t.employee_id = e.id
    WHERE t.id = ?
  `).get(id);

  if (!request) {
    return res.status(404).json({ error: 'Time off request not found' });
  }

  db.prepare(
    "UPDATE time_off_requests SET status = ?, manager_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(status, manager_notes || '', id);

  // Send email notification to employee
  try {
    const { sendTimeOffNotification } = require('../utils/gmail');
    await sendTimeOffNotification(
      request.employee_email,
      request.employee_name,
      status,
      request.request_date,
      manager_notes || ''
    );
  } catch (err) {
    // Email sending is best-effort; don't fail the request if email fails
    console.warn('Failed to send time-off notification email:', err.message);
  }

  const updatedRequest = db.prepare(`
    SELECT t.*, e.name as employee_name, e.email as employee_email
    FROM time_off_requests t
    JOIN employees e ON t.employee_id = e.id
    WHERE t.id = ?
  `).get(id);

  return res.json(updatedRequest);
});

module.exports = router;
