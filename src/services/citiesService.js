const { query } = require('../db');

function toCityResponse(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    is_active: row.is_active,
  };
}

async function list(active = true) {
  const { rows } = await query(
    `SELECT id, name, slug, is_active
     FROM cities
     WHERE is_active = $1
     ORDER BY name ASC`,
    [active]
  );
  return rows.map(toCityResponse);
}

async function getById(id) {
  const { rows } = await query(
    `SELECT id, name, slug, is_active
     FROM cities
     WHERE id = $1`,
    [id]
  );
  return rows.length > 0 ? toCityResponse(rows[0]) : null;
}

module.exports = { list, getById };
