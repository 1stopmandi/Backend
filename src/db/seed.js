/**
 * Run all seed files in order from src/db/seeds/
 * Usage: node src/db/seed.js
 * Run after: npm run migrate
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('./index');

const SEEDS_DIR = path.join(__dirname, 'seeds');

async function seed() {
  const client = await pool.connect();

  try {
    const files = fs.readdirSync(SEEDS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();                               // 001_ before 002_ before 003_

    for (const file of files) {
      const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`Seeded: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Seed ${file} failed and was rolled back:\n${err.message}`);
      }
    }

    console.log('All seeds complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});