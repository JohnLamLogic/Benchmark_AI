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

// Helper: get or create a schedule for given week_start
function getOrCreateSchedule(weekStart) {
  let schedule = db.prepare('SELECT * FROM schedules WHERE week_start = ?').get(weekStart);
  if (!schedule) {
    const result = db.prepare(
      'INSERT INTO schedules (week_start, is_saved) VALUES (?, 0)'
    ).run(weekStart);
    schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(result.lastInsertRowid);
  }
  return schedule;
}

// Helper: get shifts for a schedule, joined with employee names
function getShiftsForSchedule(scheduleId) {
  return db.prepare(`
    SELECT s.*, e.name as employee_name, e.email as employee_email
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.schedule_id = ?
    ORDER BY s.day_of_week ASC, s.start_time ASC
  `).all(scheduleId);
}

// GET /api/schedules - returns all saved schedules
router.get('/', requireAuth, (req, res) => {
  const schedules = db.prepare(
    'SELECT * FROM schedules WHERE is_saved = 1 ORDER BY week_start DESC'
  ).all();
  return res.json(schedules);
});

// GET /api/schedules/:week_start - get or create schedule for week
router.get('/:week_start', requireAuth, (req, res) => {
  const { week_start } = req.params;

  // Validate ISO date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
    return res.status(400).json({ error: 'Invalid week_start format. Use YYYY-MM-DD' });
  }

  const schedule = getOrCreateSchedule(week_start);
  const shifts = getShiftsForSchedule(schedule.id);

  return res.json({
    ...schedule,
    shifts
  });
});

// POST /api/schedules/:week_start/save - save a schedule
router.post('/:week_start/save', requireManager, (req, res) => {
  const { week_start } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
    return res.status(400).json({ error: 'Invalid week_start format. Use YYYY-MM-DD' });
  }

  const schedule = getOrCreateSchedule(week_start);

  db.prepare(
    "UPDATE schedules SET is_saved = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(schedule.id);

  const updated = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule.id);
  const shifts = getShiftsForSchedule(schedule.id);

  return res.json({ ...updated, shifts });
});

// POST /api/schedules/:week_start/load/:source_week_start - copy shifts from another week
router.post('/:week_start/load/:source_week_start', requireManager, (req, res) => {
  const { week_start, source_week_start } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start) || !/^\d{4}-\d{2}-\d{2}$/.test(source_week_start)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  // Get source schedule
  const sourceSchedule = db.prepare('SELECT * FROM schedules WHERE week_start = ?').get(source_week_start);
  if (!sourceSchedule) {
    return res.status(404).json({ error: 'Source schedule not found' });
  }

  // Get or create target schedule
  const targetSchedule = getOrCreateSchedule(week_start);

  // Clear existing shifts in target
  db.prepare('DELETE FROM shifts WHERE schedule_id = ?').run(targetSchedule.id);

  // Copy shifts from source to target
  const sourceShifts = db.prepare('SELECT * FROM shifts WHERE schedule_id = ?').all(sourceSchedule.id);

  const insertShift = db.prepare(
    'INSERT INTO shifts (schedule_id, employee_id, day_of_week, start_time, end_time, position, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const copyShifts = db.transaction(() => {
    for (const shift of sourceShifts) {
      insertShift.run(
        targetSchedule.id,
        shift.employee_id,
        shift.day_of_week,
        shift.start_time,
        shift.end_time,
        shift.position,
        shift.notes || ''
      );
    }
  });

  copyShifts();

  // Update target schedule timestamp
  db.prepare("UPDATE schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(targetSchedule.id);

  const updatedTarget = db.prepare('SELECT * FROM schedules WHERE id = ?').get(targetSchedule.id);
  const shifts = getShiftsForSchedule(targetSchedule.id);

  return res.json({ ...updatedTarget, shifts });
});

module.exports = router;
