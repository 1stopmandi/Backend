const { query } = require('../db');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function toProductResponse(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category_id: row.category_id,
    category_name: row.category_name,
    unit: row.unit,
    price_per_unit: parseFloat(row.price_per_unit),
    moq: parseFloat(row.moq),
    stock: parseFloat(row.stock ?? 0),
    image_url: row.image_url,
    city_id: row.city_id,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function list({ categoryId, cityId, page = 1, limit = DEFAULT_LIMIT } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const actualLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

  let sql = `
    SELECT p.id, p.name, p.slug, p.category_id, c.name AS category_name,
           p.unit, p.price_per_unit, p.moq, p.stock, p.image_url, p.city_id,
           p.is_active, p.created_at, p.updated_at
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = true
  `;
  const params = [];
  let paramIndex = 1;

  if (categoryId) {
    sql += ` AND p.category_id = $${paramIndex++}`;
    params.push(categoryId);
  }

  if (cityId) {
    sql += ` AND (p.city_id = $${paramIndex++} OR p.city_id IS NULL)`;
    params.push(cityId);
  }

  let countSql = 'SELECT COUNT(*)::int AS count FROM products p WHERE p.is_active = true';
  const countParams = [];
  let ci = 1;
  if (categoryId) {
    countSql += ` AND p.category_id = $${ci++}`;
    countParams.push(categoryId);
  }
  if (cityId) {
    countSql += ` AND (p.city_id = $${ci} OR p.city_id IS NULL)`;
    countParams.push(cityId);
  }
  const { rows: countRows } = await query(countSql, countParams);
  const total = parseInt(countRows[0]?.count ?? 0, 10);

  sql += ` ORDER BY p.name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(actualLimit, offset);

  const { rows } = await query(sql, params);

  return {
    data: rows.map(toProductResponse),
    pagination: {
      page: Math.floor(offset / actualLimit) + 1,
      limit: actualLimit,
      total,
      totalPages: Math.ceil(total / actualLimit) || 1,
    },
  };
}

async function getById(id) {
  const { rows } = await query(
    `SELECT p.id, p.name, p.slug, p.category_id, c.name AS category_name,
            p.unit, p.price_per_unit, p.moq, p.stock, p.image_url, p.city_id,
            p.is_active, p.created_at, p.updated_at
     FROM products p
     JOIN categories c ON p.category_id = c.id
     WHERE p.id = $1 AND p.is_active = true`,
    [id]
  );
  return rows.length > 0 ? toProductResponse(rows[0]) : null;
}

module.exports = { list, getById };
