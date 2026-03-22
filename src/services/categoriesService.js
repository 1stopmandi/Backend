const { query } = require('../db');

function toCategoryResponse(row, includeCity = false) {
  const obj = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sort_order: row.sort_order,
    city_id: row.city_id,
  };
  if (includeCity && row.city_id && row.city_name) {
    obj.city = {
      id: row.city_id,
      name: row.city_name,
      slug: row.city_slug,
    };
  }
  return obj;
}

async function list({ cityId, citySlug, active = true } = {}) {
  let sql = `
    SELECT c.id, c.name, c.slug, c.sort_order, c.city_id
    FROM categories c
    WHERE c.is_active = $1
  `;
  const params = [active];

  if (cityId) {
    sql += ` AND (c.city_id = $2 OR c.city_id IS NULL)`;
    params.push(cityId);
    sql += ` ORDER BY c.sort_order ASC, c.name ASC`;
  } else if (citySlug) {
    sql += `
      AND (c.city_id IN (SELECT id FROM cities WHERE slug = $2) OR c.city_id IS NULL)
      ORDER BY c.sort_order ASC, c.name ASC
    `;
    params.push(citySlug);
  } else {
    sql += ` AND c.city_id IS NULL ORDER BY c.sort_order ASC, c.name ASC`;
  }

  const { rows } = await query(sql, params);
  return rows.map((r) => toCategoryResponse(r, false));
}

async function getById(id) {
  const { rows } = await query(
    `SELECT c.id, c.name, c.slug, c.sort_order, c.city_id,
            ci.name AS city_name, ci.slug AS city_slug
     FROM categories c
     LEFT JOIN cities ci ON c.city_id = ci.id
     WHERE c.id = $1`,
    [id]
  );
  return rows.length > 0 ? toCategoryResponse(rows[0], true) : null;
}

module.exports = { list, getById };
