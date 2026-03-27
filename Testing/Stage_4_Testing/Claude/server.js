require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

// Seed default manager if needed
require('./db/database');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));

// In-memory sessions (no native DB required)
app.use(session({
  secret: process.env.SESSION_SECRET || 'restaurant-scheduler-secret-key',
  resave: true,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const scheduleRoutes = require('./routes/schedules');
const shiftRoutes = require('./routes/shifts');
const timeoffRoutes = require('./routes/timeoff');
const emailRoutes = require('./routes/email');

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/timeoff', timeoffRoutes);
app.use('/api/email', emailRoutes);

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Restaurant Scheduler running on http://localhost:${PORT}`));

module.exports = app;
