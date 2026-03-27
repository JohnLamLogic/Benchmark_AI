const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { users } = require('../db/store');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  const user = users.findOne(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid username or password' });
  req.session.user = { id: user.id, username: user.username, role: user.role, employee_id: user.employee_id };
  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Failed to establish session' });
    return res.json(req.session.user);
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Failed to destroy session' });
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  return res.json(req.session.user);
});

module.exports = router;
