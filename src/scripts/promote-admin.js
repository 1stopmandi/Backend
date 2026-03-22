#!/usr/bin/env node
/**
 * Promote first admin user (run before any admins exist)
 * Usage: node src/scripts/promote-admin.js <phone>
 * Example: node src/scripts/promote-admin.js 919876543210
 */
require('dotenv').config();
const { query, pool } = require('../db');

const phone = process.argv[2];
if (!phone) {
  console.error('Usage: node src/scripts/promote-admin.js <phone>');
  console.error('Example: node src/scripts/promote-admin.js 919876543210');
  process.exit(1);
}

const normalized = phone.replace(/\D/g, '');

async function promote() {
  const { rows } = await query(
    'UPDATE users SET role = $1, updated_at = now() WHERE phone = $2 RETURNING id, phone, name, role',
    ['admin', normalized]
  );
  if (rows.length === 0) {
    console.error(`No user found with phone: ${phone}`);
    console.error('User must login first (via OTP) to create an account.');
    process.exit(1);
  }
  console.log(`Promoted to admin: ${rows[0].phone} (${rows[0].name || 'no name'})`);
  await pool.end();
}

promote().catch((err) => {
  console.error(err);
  process.exit(1);
});
