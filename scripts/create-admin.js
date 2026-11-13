require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
if (!email || password.length < 14) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 14 characters) in .env before running this command.');
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 12);
db.prepare(`INSERT INTO admins(email,password_hash) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash`).run(email, hash);
console.log(`Admin account ready for ${email}. Keep the password private.`);
