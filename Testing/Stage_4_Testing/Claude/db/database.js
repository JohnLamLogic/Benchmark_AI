// db/database.js — Seeds default manager account on first run
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { users } = require('./store');

const managerExists = users.findOne(u => u.role === 'manager');
if (!managerExists) {
  const username = process.env.MANAGER_USERNAME || 'manager';
  const password = process.env.MANAGER_PASSWORD || 'admin123';
  const passwordHash = bcrypt.hashSync(password, 10);
  users.insert({ username, password_hash: passwordHash, role: 'manager', employee_id: null });
  console.log(`Default manager account created: username="${username}"`);
}

module.exports = require('./store');
