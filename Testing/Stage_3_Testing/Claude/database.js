const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'schedule.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    positions TEXT NOT NULL DEFAULT '[]',
    email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS saved_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    week_start TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    week_start TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    position TEXT NOT NULL,
    saved_schedule_id INTEGER REFERENCES saved_schedules(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─── Employee helpers ───────────────────────────────────────────────────────

const getAllEmployees = db.prepare('SELECT * FROM employees ORDER BY name ASC');
const getEmployeeById = db.prepare('SELECT * FROM employees WHERE id = ?');
const insertEmployee = db.prepare(
    'INSERT INTO employees (name, positions, email) VALUES (?, ?, ?)'
);
const updateEmployee = db.prepare(
    'UPDATE employees SET name = ?, positions = ?, email = ? WHERE id = ?'
);
const deleteEmployee = db.prepare('DELETE FROM employees WHERE id = ?');

// ─── Shift helpers ──────────────────────────────────────────────────────────

const getShiftsForWeek = db.prepare(
    'SELECT s.*, e.name as employee_name FROM shifts s JOIN employees e ON s.employee_id = e.id WHERE s.week_start = ? AND s.saved_schedule_id IS NULL ORDER BY s.day_of_week, s.start_time'
);
const getShiftById = db.prepare('SELECT * FROM shifts WHERE id = ?');
const insertShift = db.prepare(
    'INSERT INTO shifts (employee_id, week_start, day_of_week, start_time, end_time, position, saved_schedule_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const updateShift = db.prepare(
    'UPDATE shifts SET day_of_week = ?, start_time = ?, end_time = ?, position = ? WHERE id = ?'
);
const deleteShift = db.prepare('DELETE FROM shifts WHERE id = ?');
const deleteWeekShifts = db.prepare(
    'DELETE FROM shifts WHERE week_start = ? AND saved_schedule_id IS NULL'
);

// ─── Saved schedule helpers ─────────────────────────────────────────────────

const getAllSavedSchedules = db.prepare('SELECT * FROM saved_schedules ORDER BY created_at DESC');
const getSavedScheduleById = db.prepare('SELECT * FROM saved_schedules WHERE id = ?');
const insertSavedSchedule = db.prepare(
    'INSERT INTO saved_schedules (name, week_start) VALUES (?, ?)'
);
const getShiftsForSavedSchedule = db.prepare(
    'SELECT s.*, e.name as employee_name FROM shifts s JOIN employees e ON s.employee_id = e.id WHERE s.saved_schedule_id = ? ORDER BY s.day_of_week, s.start_time'
);
const deleteSavedSchedule = db.prepare('DELETE FROM saved_schedules WHERE id = ?');

module.exports = {
    // Employees
    getAllEmployees: () => {
        const rows = getAllEmployees.all();
        return rows.map(r => ({ ...r, positions: JSON.parse(r.positions) }));
    },
    getEmployeeById: (id) => {
        const r = getEmployeeById.get(id);
        if (!r) return null;
        return { ...r, positions: JSON.parse(r.positions) };
    },
    createEmployee: (name, positions, email) => {
        const result = insertEmployee.run(name, JSON.stringify(positions), email);
        return result.lastInsertRowid;
    },
    updateEmployee: (id, name, positions, email) => {
        updateEmployee.run(name, JSON.stringify(positions), email, id);
    },
    deleteEmployee: (id) => {
        deleteEmployee.run(id);
    },

    // Shifts
    getShiftsForWeek: (weekStart) => getShiftsForWeek.all(weekStart),
    getShiftById: (id) => getShiftById.get(id),
    createShift: (employeeId, weekStart, dayOfWeek, startTime, endTime, position, savedScheduleId = null) => {
        const result = insertShift.run(employeeId, weekStart, dayOfWeek, startTime, endTime, position, savedScheduleId);
        return result.lastInsertRowid;
    },
    updateShift: (id, dayOfWeek, startTime, endTime, position) => {
        updateShift.run(dayOfWeek, startTime, endTime, position, id);
    },
    deleteShift: (id) => deleteShift.run(id),
    deleteWeekShifts: (weekStart) => deleteWeekShifts.run(weekStart),

    // Saved Schedules
    getAllSavedSchedules: () => getAllSavedSchedules.all(),
    getSavedScheduleById: (id) => getSavedScheduleById.get(id),
    createSavedSchedule: (name, weekStart, shifts) => {
        const insert = db.transaction(() => {
            const result = insertSavedSchedule.run(name, weekStart);
            const savedId = result.lastInsertRowid;
            for (const shift of shifts) {
                insertShift.run(
                    shift.employee_id, shift.week_start, shift.day_of_week,
                    shift.start_time, shift.end_time, shift.position, savedId
                );
            }
            return savedId;
        });
        return insert();
    },
    getShiftsForSavedSchedule: (id) => getShiftsForSavedSchedule.all(id),
    deleteSavedSchedule: (id) => {
        deleteSavedSchedule.run(id);
    },
};
