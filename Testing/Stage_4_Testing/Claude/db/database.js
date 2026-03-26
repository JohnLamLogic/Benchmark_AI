require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'scheduler.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('manager','employee')),
    employee_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    positions TEXT NOT NULL DEFAULT '[]',
    pay_rate REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL UNIQUE,
    is_saved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    position TEXT NOT NULL,
    notes TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS time_off_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    request_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    manager_notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gmail_tokens (
    id INTEGER PRIMARY KEY CHECK(id=1),
    access_token TEXT,
    refresh_token TEXT,
    token_type TEXT,
    expiry_date INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default manager if no manager exists
const managerExists = db.prepare("SELECT id FROM users WHERE role='manager' LIMIT 1").get();
if (!managerExists) {
  const username = process.env.MANAGER_USERNAME || 'manager';
  const password = process.env.MANAGER_PASSWORD || 'admin123';
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'manager')")
    .run(username, passwordHash);
  console.log(`Default manager account created: username="${username}"`);
}

module.exports = db;
