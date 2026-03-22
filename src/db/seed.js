/**
 * Run seed data (cities, categories)
 * Usage: node src/db/seed.js
 * Run after: npm run migrate
 */
require('dotenv').config();
const { query } = require('./index');

async function seed() {
  try {
    // Cities
    await query(`
      INSERT INTO cities (name, slug, is_active)
      VALUES ('Patna', 'patna', true)
      ON CONFLICT (slug) DO NOTHING
    `);
    console.log('Seeded cities');

    // Categories (global)
    const categories = [
      ['Vegetables', 'vegetables', 1],
      ['Fruits', 'fruits', 2],
      ['Dairy', 'dairy', 3],
      ['Non-Veg', 'non-veg', 4],
      ['Grains', 'grains', 5],
      ['Spices', 'spices', 6],
      ['Oils', 'oils', 7],
      ['Pulses', 'pulses', 8],
    ];

    for (const [name, slug, sortOrder] of categories) {
      await query(`
        INSERT INTO categories (name, slug, sort_order, city_id)
        SELECT $1, $2, $3, NULL
        WHERE NOT EXISTS (
          SELECT 1 FROM categories WHERE slug = $2 AND city_id IS NULL
        )
      `, [name, slug, sortOrder]);
    }
    console.log('Seeded categories');

    // Sample products (get category ids by slug)
    const { rows: cats } = await query(
      'SELECT id, slug FROM categories WHERE city_id IS NULL'
    );
    const catBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

    const products = [
      ['Tomato', 'tomato', 'vegetables', 'kg', 40, 1, 500],
      ['Onion', 'onion', 'vegetables', 'kg', 30, 1, 300],
      ['Potato', 'potato', 'vegetables', 'kg', 25, 5, 1000],
      ['Apple', 'apple', 'fruits', 'kg', 120, 1, 200],
      ['Banana', 'banana', 'fruits', 'dozen', 60, 1, 150],
      ['Rice', 'rice-basmati', 'grains', 'kg', 80, 5, 500],
      ['Wheat Flour', 'wheat-flour', 'grains', 'kg', 45, 5, 300],
      ['Mustard Oil', 'mustard-oil', 'oils', 'litre', 180, 1, 100],
      ['Turmeric Powder', 'turmeric-powder', 'spices', 'kg', 200, 0.5, 50],
      ['Red Chilli Powder', 'red-chilli-powder', 'spices', 'kg', 250, 0.5, 40],
    ];

    for (const [name, slug, catSlug, unit, price, moq, stock] of products) {
      const catId = catBySlug[catSlug];
      if (!catId) continue;
      await query(`
        INSERT INTO products (name, slug, category_id, unit, price_per_unit, moq, stock)
        SELECT $1, $2, $3, $4, $5, $6, $7
        WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = $2 AND city_id IS NULL)
      `, [name, slug, catId, unit, price, moq, stock]);
    }
    console.log('Seeded products');

    console.log('Seed complete.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    const { pool } = require('./index');
    await pool.end();
  }
}

seed();
