const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
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

// GET /api/employees - all authenticated users can access
router.get('/', requireAuth, (req, res) => {
  const employees = db.prepare('SELECT * FROM employees ORDER BY name ASC').all();
  return res.json(employees);
});

// POST /api/employees - manager only
router.post('/', requireManager, (req, res) => {
  const { name, email, positions, pay_rate } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  // Check for duplicate email
  const existing = db.prepare('SELECT id FROM employees WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: 'An employee with this email already exists' });
  }

  const positionsJson = JSON.stringify(Array.isArray(positions) ? positions : []);
  const payRate = parseFloat(pay_rate) || 0;

  // Insert employee
  const empResult = db.prepare(
    'INSERT INTO employees (name, email, positions, pay_rate) VALUES (?, ?, ?, ?)'
  ).run(name, email, positionsJson, payRate);

  const employeeId = empResult.lastInsertRowid;

  // Create user account for employee
  // username = email, password = name.toLowerCase().replace(/\s+/g,'')
  const username = email;
  const rawPassword = name.toLowerCase().replace(/\s+/g, '');
  const passwordHash = bcrypt.hashSync(rawPassword, 10);

  try {
    db.prepare(
      "INSERT INTO users (username, password_hash, role, employee_id) VALUES (?, ?, 'employee', ?)"
    ).run(username, passwordHash, employeeId);
  } catch (err) {
    // If user already exists with this email/username, just update their employee_id
    db.prepare('UPDATE users SET employee_id = ? WHERE username = ?')
      .run(employeeId, username);
  }

  const newEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  return res.status(201).json(newEmployee);
});

// PUT /api/employees/:id - manager only
router.put('/:id', requireManager, (req, res) => {
  const { id } = req.params;
  const { name, email, positions, pay_rate } = req.body;

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const newName = name || employee.name;
  const newEmail = email || employee.email;
  const newPositions = Array.isArray(positions) ? JSON.stringify(positions) : employee.positions;
  const newPayRate = pay_rate !== undefined ? parseFloat(pay_rate) : employee.pay_rate;

  // Check for duplicate email (excluding this employee)
  if (newEmail !== employee.email) {
    const emailConflict = db.prepare('SELECT id FROM employees WHERE email = ? AND id != ?').get(newEmail, id);
    if (emailConflict) {
      return res.status(400).json({ error: 'Another employee with this email already exists' });
    }
  }

  db.prepare(
    'UPDATE employees SET name = ?, email = ?, positions = ?, pay_rate = ? WHERE id = ?'
  ).run(newName, newEmail, newPositions, newPayRate, id);

  // Update user account username if email changed
  if (newEmail !== employee.email) {
    db.prepare('UPDATE users SET username = ? WHERE employee_id = ?').run(newEmail, id);
  }

  const updatedEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  return res.json(updatedEmployee);
});

// DELETE /api/employees/:id - manager only
router.delete('/:id', requireManager, (req, res) => {
  const { id } = req.params;

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  // Delete all shifts for this employee
  db.prepare('DELETE FROM shifts WHERE employee_id = ?').run(id);

  // Delete all time off requests for this employee
  db.prepare('DELETE FROM time_off_requests WHERE employee_id = ?').run(id);

  // Delete user account
  db.prepare('DELETE FROM users WHERE employee_id = ?').run(id);

  // Delete employee
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);

  return res.json({ success: true, message: 'Employee deleted successfully' });
});

module.exports = router;
