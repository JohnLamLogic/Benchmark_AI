require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');

const { buildSchedulePdf } = require('./schedulePdf');
const { sendScheduleEmails } = require('./gmail');
const { loadState, writeState } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const normalizePositionsInput = (positions) => {
  if (!positions) {
    return [];
  }

  const rawPositions = Array.isArray(positions)
    ? positions
    : typeof positions === 'string'
      ? positions.split(',')
      : [];

  return rawPositions.map((position) => position.trim()).filter(Boolean);
};

const normalizeWeekStart = (input) => {
  const candidate = input ? new Date(input) : new Date();
  if (Number.isNaN(candidate.getTime())) {
    throw new Error('Invalid date for week start');
  }
  const day = candidate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  candidate.setHours(0, 0, 0, 0);
  candidate.setDate(candidate.getDate() + diff);
  return candidate.toISOString().slice(0, 10);
};

const ensureStateShape = (state) => ({
  employees: Array.isArray(state?.employees) ? state.employees : [],
  schedules: Array.isArray(state?.schedules) ? state.schedules : [],
  shifts: Array.isArray(state?.shifts) ? state.shifts : []
});

const loadFreshState = () => ensureStateShape(loadState());

const fetchEmployees = (state) =>
  (state.employees || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((employee) => ({
      ...employee,
      positions: Array.isArray(employee.positions) ? employee.positions : []
    }));

const mapShiftRows = (rows, state) =>
  (rows || []).map((shift) => ({
    id: shift.id,
    employeeId: shift.employeeId,
    employeeName: state.employees.find((employee) => employee.id === shift.employeeId)?.name || 'Unknown',
    day: shift.day,
    position: shift.position,
    startTime: shift.startTime,
    endTime: shift.endTime,
    note: shift.note
  }));

const getScheduleEntity = (predicate, state) => {
  const schedule = state.schedules.find(predicate);
  if (!schedule) {
    return null;
  }

  const shifts = state.shifts.filter((shift) => shift.scheduleId === schedule.id);
  return {
    id: schedule.id,
    weekStart: schedule.weekStart,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    shifts: mapShiftRows(shifts, state)
  };
};

const getScheduleByWeek = (weekStart, state) =>
  getScheduleEntity((schedule) => schedule.weekStart === weekStart, state);

const getScheduleById = (id, state) =>
  getScheduleEntity((schedule) => schedule.id === id, state);

app.get('/api/employees', (req, res) => {
  try {
    const state = loadFreshState();
    res.json({ employees: fetchEmployees(state) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load employees.' });
  }
});

app.post('/api/employees', (req, res) => {
  try {
    const { name, email, positions } = req.body;
    const normalizedPositions = normalizePositionsInput(positions);
    if (!name || normalizedPositions.length === 0) {
      return res.status(400).json({ error: 'Name and positions are required.' });
    }

    const state = loadFreshState();
    const trimmedEmail = email ? email.trim() : null;
    if (trimmedEmail && state.employees.some((employee) => employee.email && employee.email.toLowerCase() === trimmedEmail.toLowerCase())) {
      return res.status(400).json({ error: 'That email is already used.' });
    }

    state.employees.push({
      id: randomUUID(),
      name: name.trim(),
      email: trimmedEmail || null,
      positions: normalizedPositions,
      createdAt: new Date().toISOString()
    });

    writeState(state);
    res.json({ employees: fetchEmployees(state) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create employee.' });
  }
});

app.put('/api/employees/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, positions } = req.body;
    const normalizedPositions = normalizePositionsInput(positions);
    if (!name || normalizedPositions.length === 0) {
      return res.status(400).json({ error: 'Name and positions are required.' });
    }

    const state = loadFreshState();
    const employeeIndex = state.employees.findIndex((employee) => employee.id === id);
    if (employeeIndex === -1) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const trimmedEmail = email ? email.trim() : null;
    if (
      trimmedEmail &&
      state.employees.some(
        (employee) => employee.email && employee.email.toLowerCase() === trimmedEmail.toLowerCase() && employee.id !== id
      )
    ) {
      return res.status(400).json({ error: 'That email is already used.' });
    }

    state.employees[employeeIndex] = {
      ...state.employees[employeeIndex],
      name: name.trim(),
      email: trimmedEmail || null,
      positions: normalizedPositions
    };

    writeState(state);
    res.json({ employees: fetchEmployees(state) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update employee.' });
  }
});

app.delete('/api/employees/:id', (req, res) => {
  try {
    const { id } = req.params;
    const state = loadFreshState();
    const keptEmployees = state.employees.filter((employee) => employee.id !== id);
    if (keptEmployees.length === state.employees.length) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    state.employees = keptEmployees;
    state.shifts = state.shifts.filter((shift) => shift.employeeId !== id);

    writeState(state);
    res.json({ employees: fetchEmployees(state) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove employee.' });
  }
});

app.get('/api/schedules/archive', (req, res) => {
  try {
    const state = loadFreshState();
    const sorted = [...state.schedules].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
    res.json({
      schedules: sorted.map((row) => ({
        id: row.id,
        weekStart: row.weekStart,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load saved schedules.' });
  }
});

app.get('/api/schedules', (req, res) => {
  try {
    const weekStart = normalizeWeekStart(req.query.weekStart);
    const state = loadFreshState();
    const schedule = getScheduleByWeek(weekStart, state);
    res.json({ schedule });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/schedules', (req, res) => {
  try {
    const weekStart = normalizeWeekStart(req.body.weekStart);
    const shiftPayload = Array.isArray(req.body.shifts) ? req.body.shifts : [];
    const state = loadFreshState();
    const now = new Date().toISOString();

    let schedule = state.schedules.find((item) => item.weekStart === weekStart);
    if (schedule) {
      schedule.updatedAt = now;
    } else {
      schedule = { id: randomUUID(), weekStart, createdAt: now, updatedAt: now };
      state.schedules.push(schedule);
    }

    state.shifts = state.shifts.filter((shift) => shift.scheduleId !== schedule.id);
    const newShifts = [];
    for (const candidate of shiftPayload) {
      if (!candidate.employeeId || typeof candidate.day !== 'number') {
        continue;
      }
      if (candidate.day < 0 || candidate.day > 6) {
        continue;
      }
      if (!candidate.position) {
        continue;
      }
      newShifts.push({
        id: randomUUID(),
        scheduleId: schedule.id,
        employeeId: candidate.employeeId,
        day: candidate.day,
        position: candidate.position,
        startTime: candidate.startTime || null,
        endTime: candidate.endTime || null,
        note: candidate.note || null
      });
    }
    state.shifts.push(...newShifts);

    writeState(state);
    const saved = getScheduleByWeek(weekStart, state);
    res.json({ schedule: saved });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to persist schedule.' });
  }
});

app.post('/api/schedules/:id/clone', (req, res) => {
  try {
    const { id } = req.params;
    const targetWeek = normalizeWeekStart(req.body.weekStart);
    const state = loadFreshState();
    if (state.schedules.some((item) => item.weekStart === targetWeek)) {
      return res.status(400).json({ error: 'There is already a saved schedule for that week.' });
    }

    const source = state.schedules.find((item) => item.id === id);
    if (!source) {
      return res.status(404).json({ error: 'Source schedule not found.' });
    }

    const now = new Date().toISOString();
    const newScheduleId = randomUUID();
    state.schedules.push({
      id: newScheduleId,
      weekStart: targetWeek,
      createdAt: now,
      updatedAt: now
    });

    const sourceShifts = state.shifts.filter((shift) => shift.scheduleId === id);
    const clones = sourceShifts.map((shift) => ({
      ...shift,
      id: randomUUID(),
      scheduleId: newScheduleId
    }));
    state.shifts.push(...clones);

    writeState(state);
    const schedule = getScheduleByWeek(targetWeek, state);
    res.json({ schedule });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to clone schedule.' });
  }
});

app.get('/api/schedules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const state = loadFreshState();
    const schedule = getScheduleById(id, state);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }
    res.json({ schedule });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load schedule.' });
  }
});

app.get('/api/schedules/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const state = loadFreshState();
    const schedule = getScheduleById(id, state);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }

    const employees = fetchEmployees(state);
    const pdfBuffer = await buildSchedulePdf(schedule, employees, schedule.shifts);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="schedule-${schedule.weekStart}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to render PDF.' });
  }
});

app.post('/api/email/send', async (req, res) => {
  try {
    const { scheduleId } = req.body;
    if (!scheduleId) {
      return res.status(400).json({ error: 'Schedule id is required.' });
    }

    const state = loadFreshState();
    const schedule = getScheduleById(scheduleId, state);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found.' });
    }

    const employees = fetchEmployees(state);
    const pdfBuffer = await buildSchedulePdf({ id: scheduleId, weekStart: schedule.weekStart }, employees, schedule.shifts);

    const delivery = await sendScheduleEmails(schedule.weekStart, employees, pdfBuffer);
    res.json({ delivery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Unable to send emails.' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Scheduler API listening on http://localhost:${PORT}`);
});
