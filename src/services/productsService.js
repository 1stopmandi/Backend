const { query } = require('../db');
const pricingService = require('./pricingService');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

async function buildProductDto(row, cityId, qty) {
  const category = row.category_id
    ? { id: row.category_id, name: row.category_name }
    : null;
  const pricing = await pricingService.getProductPricingForApi(
    row.id,
    qty,
    cityId || null
  );
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    unit: row.unit,
    image_url: row.image_url,
    moq: parseFloat(row.moq),
    stock: parseFloat(row.stock ?? 0),
    is_active: row.is_active,
    category,
    pricing,
  };
}

async function list({
  categoryId,
  cityId,
  search,
  qty,
  page = 1,
  limit = DEFAULT_LIMIT,
} = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const actualLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
  const qtyNum = qty != null && !Number.isNaN(parseFloat(qty)) ? parseFloat(qty) : 1;

  let sql = `
    SELECT p.id, p.name, p.slug, p.category_id, c.name AS category_name,
           p.unit, p.moq, p.stock, p.image_url, p.city_id, p.is_active,
           p.created_at, p.updated_at
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
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

  if (search && String(search).trim()) {
    sql += ` AND (p.name ILIKE $${paramIndex} OR p.slug ILIKE $${paramIndex})`;
    params.push(`%${String(search).trim()}%`);
    paramIndex += 1;
  }

  let countSql = `
    SELECT COUNT(*)::int AS count FROM products p
    WHERE p.is_active = true
  `;
  const countParams = [];
  let ci = 1;
  if (categoryId) {
    countSql += ` AND p.category_id = $${ci++}`;
    countParams.push(categoryId);
  }
  if (cityId) {
    countSql += ` AND (p.city_id = $${ci++} OR p.city_id IS NULL)`;
    countParams.push(cityId);
  }
  if (search && String(search).trim()) {
    countSql += ` AND (p.name ILIKE $${ci} OR p.slug ILIKE $${ci})`;
    countParams.push(`%${String(search).trim()}%`);
  }

  const { rows: countRows } = await query(countSql, countParams);
  const total = parseInt(countRows[0]?.count ?? 0, 10);

  sql += ` ORDER BY p.name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(actualLimit, offset);

  const { rows } = await query(sql, params);

  const data = [];
  for (const row of rows) {
    data.push(await buildProductDto(row, cityId, qtyNum));
  }

  return {
    data,
    pagination: {
      page: Math.floor(offset / actualLimit) + 1,
      limit: actualLimit,
      total,
      totalPages: Math.ceil(total / actualLimit) || 1,
    },
  };
}

async function getById(id, cityId, qty) {
  const qtyNum = qty != null && !Number.isNaN(parseFloat(qty)) ? parseFloat(qty) : 1;
  const { rows } = await query(
    `SELECT p.id, p.name, p.slug, p.category_id, c.name AS category_name,
            p.unit, p.moq, p.stock, p.image_url, p.city_id,
            p.is_active, p.created_at, p.updated_at
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = $1 AND p.is_active = true`,
    [id]
  );
  if (rows.length === 0) return null;
  return buildProductDto(rows[0], cityId, qtyNum);
}

module.exports = { list, getById };
