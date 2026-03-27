const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { employees, users, shifts, timeoff } = require('../db/store');

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}
function requireManager(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.session.user.role !== 'manager') return res.status(403).json({ error: 'Manager access required' });
  next();
}

router.get('/', requireAuth, (req, res) => {
  return res.json(employees.findAll().sort((a, b) => a.name.localeCompare(b.name)));
});

router.post('/', requireManager, (req, res) => {
  const { name, email, positions, pay_rate } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
  if (employees.findOne(e => e.email === email)) return res.status(400).json({ error: 'An employee with this email already exists' });

  const newEmployee = employees.insert({
    name,
    email,
    positions: JSON.stringify(Array.isArray(positions) ? positions : []),
    pay_rate: parseFloat(pay_rate) || 0
  });

  const username = email;
  const passwordHash = bcrypt.hashSync(name.toLowerCase().replace(/\s+/g, ''), 10);
  const existingUser = users.findOne(u => u.username === username);
  if (existingUser) {
    users.update(existingUser.id, { employee_id: newEmployee.id });
  } else {
    users.insert({ username, password_hash: passwordHash, role: 'employee', employee_id: newEmployee.id });
  }

  return res.status(201).json(newEmployee);
});

router.put('/:id', requireManager, (req, res) => {
  const { id } = req.params;
  const employee = employees.findById(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const { name, email, positions, pay_rate } = req.body;
  const newEmail = email || employee.email;

  if (newEmail !== employee.email) {
    if (employees.findOne(e => e.email === newEmail && e.id !== parseInt(id))) {
      return res.status(400).json({ error: 'Another employee with this email already exists' });
    }
  }

  const updated = employees.update(id, {
    name: name || employee.name,
    email: newEmail,
    positions: Array.isArray(positions) ? JSON.stringify(positions) : employee.positions,
    pay_rate: pay_rate !== undefined ? parseFloat(pay_rate) : employee.pay_rate
  });

  if (newEmail !== employee.email) {
    const userAccount = users.findOne(u => u.employee_id === parseInt(id));
    if (userAccount) users.update(userAccount.id, { username: newEmail });
  }

  return res.json(updated);
});

router.delete('/:id', requireManager, (req, res) => {
  const { id } = req.params;
  if (!employees.findById(id)) return res.status(404).json({ error: 'Employee not found' });
  const numId = parseInt(id);
  shifts.deleteWhere(s => s.employee_id === numId);
  timeoff.deleteWhere(t => t.employee_id === numId);
  users.deleteWhere(u => u.employee_id === numId);
  employees.delete(id);
  return res.json({ success: true, message: 'Employee deleted successfully' });
});

module.exports = router;
