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

function calculateHours(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let start = sh * 60 + sm, end = eh * 60 + em;
  if (end < start) end += 24 * 60;
  return (end - start) / 60;
}

function getOrCreateSchedule(weekStart) {
  let s = schedules.findOne(s => s.week_start === weekStart);
  if (!s) s = schedules.insert({ week_start: weekStart, is_saved: 0 });
  return s;
}

router.post('/', requireManager, (req, res) => {
  const { schedule_id, week_start, employee_id, day_of_week, start_time, end_time, position, notes } = req.body;
  if (!employee_id || day_of_week === undefined || !start_time || !end_time || !position) {
    return res.status(400).json({ error: 'employee_id, day_of_week, start_time, end_time, and position are required' });
  }
  const employee = employees.findById(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  let scheduleId = schedule_id ? parseInt(schedule_id) : null;
  if (!scheduleId && week_start) scheduleId = getOrCreateSchedule(week_start).id;
  if (!scheduleId) return res.status(400).json({ error: 'Either schedule_id or week_start must be provided' });
  if (!schedules.findById(scheduleId)) return res.status(404).json({ error: 'Schedule not found' });

  const newShift = shifts.insert({ schedule_id: scheduleId, employee_id: parseInt(employee_id), day_of_week: parseInt(day_of_week), start_time, end_time, position, notes: notes || '' });
  schedules.update(scheduleId, {});
  return res.status(201).json({ ...newShift, employee_name: employee.name });
});

router.put('/:id', requireManager, (req, res) => {
  const { id } = req.params;
  const shift = shifts.findById(id);
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  const { employee_id, day_of_week, start_time, end_time, position, notes } = req.body;
  const updates = {
    employee_id: employee_id !== undefined ? parseInt(employee_id) : shift.employee_id,
    day_of_week: day_of_week !== undefined ? parseInt(day_of_week) : shift.day_of_week,
    start_time: start_time || shift.start_time,
    end_time: end_time || shift.end_time,
    position: position || shift.position,
    notes: notes !== undefined ? notes : shift.notes
  };
  const updated = shifts.update(id, updates);
  const employee = employees.findById(updated.employee_id);
  schedules.update(shift.schedule_id, {});
  return res.json({ ...updated, employee_name: employee?.name || 'Unknown' });
});

router.delete('/:id', requireManager, (req, res) => {
  const { id } = req.params;
  const shift = shifts.findById(id);
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  shifts.delete(id);
  schedules.update(shift.schedule_id, {});
  return res.json({ success: true, message: 'Shift deleted successfully' });
});

router.get('/hours/all', requireManager, (req, res) => {
  const allEmployees = employees.findAll().sort((a, b) => a.name.localeCompare(b.name));
  const schedMap = {};
  schedules.findAll().forEach(s => { schedMap[s.id] = s; });
  const result = allEmployees.map(emp => {
    const weekMap = {};
    shifts.findAll(s => s.employee_id === emp.id).forEach(shift => {
      const sched = schedMap[shift.schedule_id];
      if (!sched) return;
      const ws = sched.week_start;
      if (!weekMap[ws]) weekMap[ws] = { week_start: ws, hours: 0, shifts: [] };
      weekMap[ws].hours += calculateHours(shift.start_time, shift.end_time);
      weekMap[ws].shifts.push(shift);
    });
    return { employee_id: emp.id, employee_name: emp.name, pay_rate: emp.pay_rate, weeks: Object.values(weekMap).sort((a, b) => b.week_start.localeCompare(a.week_start)) };
  });
  return res.json(result);
});

router.get('/hours/:employee_id', requireAuth, (req, res) => {
  const { employee_id } = req.params;
  if (req.session.user.role === 'employee' && req.session.user.employee_id != employee_id) return res.status(403).json({ error: 'Access denied' });
  const employee = employees.findById(employee_id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  const schedMap = {};
  schedules.findAll().forEach(s => { schedMap[s.id] = s; });
  const weekMap = {};
  shifts.findAll(s => s.employee_id === parseInt(employee_id)).forEach(shift => {
    const sched = schedMap[shift.schedule_id];
    if (!sched) return;
    const ws = sched.week_start;
    if (!weekMap[ws]) weekMap[ws] = { week_start: ws, hours: 0, shifts: [] };
    weekMap[ws].hours += calculateHours(shift.start_time, shift.end_time);
    weekMap[ws].shifts.push(shift);
  });
  return res.json({ employee_id: employee.id, employee_name: employee.name, pay_rate: employee.pay_rate, weeks: Object.values(weekMap).sort((a, b) => b.week_start.localeCompare(a.week_start)) });
});

module.exports = router;
