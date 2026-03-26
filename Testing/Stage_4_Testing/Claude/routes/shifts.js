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

// Helper: calculate hours between two HH:MM times
function calculateHours(startTime, endTime) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  // Handle overnight shifts
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  return (endMinutes - startMinutes) / 60;
}

// Helper: get or create schedule for a week_start
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

// POST /api/shifts - manager only: create a shift
router.post('/', requireManager, (req, res) => {
  const { schedule_id, week_start, employee_id, day_of_week, start_time, end_time, position, notes } = req.body;

  if (!employee_id || day_of_week === undefined || !start_time || !end_time || !position) {
    return res.status(400).json({ error: 'employee_id, day_of_week, start_time, end_time, and position are required' });
  }

  // Validate employee exists
  const employee = db.prepare('SELECT id FROM employees WHERE id = ?').get(employee_id);
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  let scheduleId = schedule_id;

  // If no schedule_id provided but week_start is given, get or create
  if (!scheduleId && week_start) {
    const schedule = getOrCreateSchedule(week_start);
    scheduleId = schedule.id;
  }

  if (!scheduleId) {
    return res.status(400).json({ error: 'Either schedule_id or week_start must be provided' });
  }

  // Validate schedule exists
  const schedule = db.prepare('SELECT id FROM schedules WHERE id = ?').get(scheduleId);
  if (!schedule) {
    return res.status(404).json({ error: 'Schedule not found' });
  }

  const result = db.prepare(
    'INSERT INTO shifts (schedule_id, employee_id, day_of_week, start_time, end_time, position, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(scheduleId, employee_id, day_of_week, start_time, end_time, position, notes || '');

  const newShift = db.prepare(`
    SELECT s.*, e.name as employee_name
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.id = ?
  `).get(result.lastInsertRowid);

  // Update schedule timestamp
  db.prepare("UPDATE schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(scheduleId);

  return res.status(201).json(newShift);
});

// PUT /api/shifts/:id - manager only: update a shift
router.put('/:id', requireManager, (req, res) => {
  const { id } = req.params;
  const { employee_id, day_of_week, start_time, end_time, position, notes } = req.body;

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found' });
  }

  const newEmployeeId = employee_id !== undefined ? employee_id : shift.employee_id;
  const newDayOfWeek = day_of_week !== undefined ? day_of_week : shift.day_of_week;
  const newStartTime = start_time || shift.start_time;
  const newEndTime = end_time || shift.end_time;
  const newPosition = position || shift.position;
  const newNotes = notes !== undefined ? notes : shift.notes;

  db.prepare(
    'UPDATE shifts SET employee_id = ?, day_of_week = ?, start_time = ?, end_time = ?, position = ?, notes = ? WHERE id = ?'
  ).run(newEmployeeId, newDayOfWeek, newStartTime, newEndTime, newPosition, newNotes, id);

  const updatedShift = db.prepare(`
    SELECT s.*, e.name as employee_name
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    WHERE s.id = ?
  `).get(id);

  // Update schedule timestamp
  db.prepare("UPDATE schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(shift.schedule_id);

  return res.json(updatedShift);
});

// DELETE /api/shifts/:id - manager only: delete a shift
router.delete('/:id', requireManager, (req, res) => {
  const { id } = req.params;

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found' });
  }

  db.prepare('DELETE FROM shifts WHERE id = ?').run(id);

  // Update schedule timestamp
  db.prepare("UPDATE schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(shift.schedule_id);

  return res.json({ success: true, message: 'Shift deleted successfully' });
});

// GET /api/shifts/hours/all - manager only: hours for all employees all weeks
router.get('/hours/all', requireManager, (req, res) => {
  const employees = db.prepare('SELECT * FROM employees ORDER BY name ASC').all();
  const result = [];

  for (const employee of employees) {
    const shiftsData = db.prepare(`
      SELECT s.*, sch.week_start
      FROM shifts s
      JOIN schedules sch ON s.schedule_id = sch.id
      WHERE s.employee_id = ?
      ORDER BY sch.week_start DESC, s.day_of_week ASC
    `).all(employee.id);

    // Group by week
    const weekMap = {};
    for (const shift of shiftsData) {
      if (!weekMap[shift.week_start]) {
        weekMap[shift.week_start] = { week_start: shift.week_start, hours: 0, shifts: [] };
      }
      const hours = calculateHours(shift.start_time, shift.end_time);
      weekMap[shift.week_start].hours += hours;
      weekMap[shift.week_start].shifts.push(shift);
    }

    const weeks = Object.values(weekMap).sort((a, b) => b.week_start.localeCompare(a.week_start));

    result.push({
      employee_id: employee.id,
      employee_name: employee.name,
      pay_rate: employee.pay_rate,
      weeks
    });
  }

  return res.json(result);
});

// GET /api/shifts/hours/:employee_id - hours per week for an employee
router.get('/hours/:employee_id', requireAuth, (req, res) => {
  const { employee_id } = req.params;

  // Employees can only view their own hours
  if (req.session.user.role === 'employee' && req.session.user.employee_id != employee_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const shiftsData = db.prepare(`
    SELECT s.*, sch.week_start
    FROM shifts s
    JOIN schedules sch ON s.schedule_id = sch.id
    WHERE s.employee_id = ?
    ORDER BY sch.week_start DESC, s.day_of_week ASC
  `).all(employee_id);

  // Group by week
  const weekMap = {};
  for (const shift of shiftsData) {
    if (!weekMap[shift.week_start]) {
      weekMap[shift.week_start] = { week_start: shift.week_start, hours: 0, shifts: [] };
    }
    const hours = calculateHours(shift.start_time, shift.end_time);
    weekMap[shift.week_start].hours += hours;
    weekMap[shift.week_start].shifts.push(shift);
  }

  const weeks = Object.values(weekMap).sort((a, b) => b.week_start.localeCompare(a.week_start));

  return res.json({
    employee_id: employee.id,
    employee_name: employee.name,
    pay_rate: employee.pay_rate,
    weeks
  });
});

module.exports = router;
