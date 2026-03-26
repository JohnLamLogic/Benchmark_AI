require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

// Initialize database (creates tables and default manager)
const db = require('./db/database');

const app = express();

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Session store using connect-sqlite3
const SQLiteStore = require('connect-sqlite3')(session);

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.join(__dirname, 'db')
  }),
  secret: process.env.SESSION_SECRET || 'restaurant-scheduler-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
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

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all: serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Restaurant Scheduler running on http://localhost:${PORT}`);
});

module.exports = app;
