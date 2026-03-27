const express = require('express');
const router = express.Router();
const { schedules, shifts, employees } = require('../db/store');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}
function requireManager(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.session.user.role !== 'manager') return res.status(403).json({ error: 'Manager access required' });
  next();
}

function getOrCreateSchedule(weekStart) {
  let schedule = schedules.findOne(s => s.week_start === weekStart);
  if (!schedule) schedule = schedules.insert({ week_start: weekStart, is_saved: 0 });
  return schedule;
}

function getShiftsForSchedule(scheduleId) {
  const empMap = {};
  employees.findAll().forEach(e => { empMap[e.id] = e; });
  return shifts.findAll(s => s.schedule_id === scheduleId)
    .map(s => ({ ...s, employee_name: empMap[s.employee_id]?.name || 'Unknown', employee_email: empMap[s.employee_id]?.email || '' }))
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
}

router.get('/', requireAuth, (req, res) => {
  return res.json(schedules.findAll(s => s.is_saved === 1).sort((a, b) => b.week_start.localeCompare(a.week_start)));
});

router.get('/:week_start', requireAuth, (req, res) => {
  const { week_start } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) return res.status(400).json({ error: 'Invalid week_start format. Use YYYY-MM-DD' });
  const schedule = getOrCreateSchedule(week_start);
  return res.json({ ...schedule, shifts: getShiftsForSchedule(schedule.id) });
});

router.post('/:week_start/save', requireManager, (req, res) => {
  const { week_start } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) return res.status(400).json({ error: 'Invalid week_start format' });
  const schedule = getOrCreateSchedule(week_start);
  const updated = schedules.update(schedule.id, { is_saved: 1 });
  return res.json({ ...updated, shifts: getShiftsForSchedule(updated.id) });
});

router.post('/:week_start/load/:source_week_start', requireManager, (req, res) => {
  const { week_start, source_week_start } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start) || !/^\d{4}-\d{2}-\d{2}$/.test(source_week_start)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }
  const sourceSchedule = schedules.findOne(s => s.week_start === source_week_start);
  if (!sourceSchedule) return res.status(404).json({ error: 'Source schedule not found' });
  const targetSchedule = getOrCreateSchedule(week_start);
  shifts.deleteWhere(s => s.schedule_id === targetSchedule.id);
  shifts.findAll(s => s.schedule_id === sourceSchedule.id).forEach(shift => {
    shifts.insert({ schedule_id: targetSchedule.id, employee_id: shift.employee_id, day_of_week: shift.day_of_week, start_time: shift.start_time, end_time: shift.end_time, position: shift.position, notes: shift.notes || '' });
  });
  const updated = schedules.update(targetSchedule.id, {});
  return res.json({ ...updated, shifts: getShiftsForSchedule(updated.id) });
});

module.exports = router;
