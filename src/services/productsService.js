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

async function getBySlug(slug, cityId, qty) {
  const qtyNum = qty != null && !Number.isNaN(parseFloat(qty)) ? parseFloat(qty) : 1;
  const { rows } = await query(
    `SELECT p.id, p.name, p.slug, p.category_id, c.name AS category_name,
            p.unit, p.moq, p.stock, p.image_url, p.city_id,
            p.is_active, p.created_at, p.updated_at
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.slug = $1 AND p.is_active = true`,
    [slug]
  );
  if (rows.length === 0) return null;
  return buildProductDto(rows[0], cityId, qtyNum);
}

async function getSuggestions(searchQuery, cityId, limit = 5) {
  const actualLimit = Math.min(Math.max(1, limit), 10); // max 10
  const query_str = String(searchQuery || '').trim();

  if (!query_str || query_str.length < 3) {
    return [];
  }

  const { rows } = await query(
    `SELECT p.id, p.name, p.slug
     FROM products p
     WHERE p.is_active = true
       AND (${cityId ? `(p.city_id = $1 OR p.city_id IS NULL)` : `p.city_id IS NULL`})
       AND p.search_vector @@ plainto_tsquery('english', $${cityId ? 2 : 1})
     LIMIT $${cityId ? 3 : 2}`,
    cityId 
      ? [cityId, query_str, actualLimit]
      : [query_str, actualLimit]
  );

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
  }));
}

async function search({
  q = '',
  categoryId,
  minPrice,
  maxPrice,
  isVeg,
  cityId,
  page = 1,
  limit = 20,
  qty = 1,
} = {}) {
  const query_str = String(q || '').trim();
  
  // Validate min query length
  if (query_str && query_str.length < 3) {
    return {
      data: [],
      filters: { available: [] },
      pagination: { page: 1, limit, total: 0, totalPages: 0 },
    };
  }

  const offset = (Math.max(1, page) - 1) * limit;
  const actualLimit = Math.min(Math.max(1, limit), 50); // max 50
  const qtyNum = qty != null && !Number.isNaN(parseFloat(qty)) ? parseFloat(qty) : 1;

  // Build WHERE conditions with proper indexing
  const conditions = ['p.is_active = true'];
  const params = [];
  let paramIdx = 1;

  if (cityId) {
    conditions.push(`(p.city_id = $${paramIdx++} OR p.city_id IS NULL)`);
    params.push(cityId);
  } else {
    conditions.push(`p.city_id IS NULL`);
  }

  if (query_str) {
    conditions.push(`p.search_vector @@ plainto_tsquery('english', $${paramIdx++})`);
    params.push(query_str);
  }

  if (categoryId) {
    conditions.push(`p.category_id = $${paramIdx++}`);
    params.push(categoryId);
  }

  if (isVeg !== undefined && isVeg !== null) {
    conditions.push(`p.is_veg = $${paramIdx++}`);
    params.push(isVeg === 'true' || isVeg === true);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count FROM products p WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRows[0]?.count ?? 0, 10);

  // Fetch products with pagination
  const sqlParams = [...params, actualLimit, offset];
  const { rows } = await query(
    `SELECT p.id, p.name, p.slug, p.category_id, c.name AS category_name,
            p.unit, p.moq, p.stock, p.image_url, p.city_id, p.is_active,
            p.created_at, p.updated_at
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE ${whereClause}
     ORDER BY p.name ASC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    sqlParams
  );

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

async function getFilters(cityId, categoryId, isVeg) {
  // Build base WHERE for filtering
  const conditions = ['p.is_active = true'];
  const params = [];
  let paramIdx = 1;

  if (cityId) {
    conditions.push(`(p.city_id = $${paramIdx++} OR p.city_id IS NULL)`);
    params.push(cityId);
  } else {
    conditions.push(`p.city_id IS NULL`);
  }

  if (categoryId) {
    conditions.push(`p.category_id = $${paramIdx++}`);
    params.push(categoryId);
  }

  if (isVeg !== undefined && isVeg !== null) {
    conditions.push(`p.is_veg = $${paramIdx++}`);
    params.push(isVeg === 'true' || isVeg === true);
  }

  const whereClause = conditions.join(' AND ');

  // Get categories with counts
  const { rows: categories } = await query(
    `SELECT c.id, c.name, COUNT(p.id)::int AS count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND ${whereClause}
     WHERE c.slug IN (SELECT DISTINCT slug FROM categories)
     GROUP BY c.id, c.name
     ORDER BY c.name ASC`,
    params
  );

  // Get price range
  const { rows: priceRows } = await query(
    `SELECT 
       MIN(pp.base_price)::numeric AS min_price,
       MAX(pp.base_price)::numeric AS max_price
     FROM products p
     JOIN product_pricing pp ON p.id = pp.product_id AND pp.is_active = true AND pp.valid_to IS NULL
     WHERE ${whereClause}`,
    params
  );

  const minPrice = priceRows[0]?.min_price ? parseFloat(priceRows[0].min_price) : 0;
  const maxPrice = priceRows[0]?.max_price ? parseFloat(priceRows[0].max_price) : 0;

  // Get unique brands (if any have non-null brand)
  const { rows: brandRows } = await query(
    `SELECT DISTINCT p.brand, COUNT(p.id)::int AS count
     FROM products p
     WHERE ${whereClause} AND p.brand IS NOT NULL
     GROUP BY p.brand
     ORDER BY p.brand ASC`,
    params
  );

  const brands = brandRows.filter(b => b.brand).map(b => ({
    name: b.brand,
    count: b.count,
  }));

  return {
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      count: c.count,
    })),
    priceRange: { min: minPrice, max: maxPrice },
    vegetarian: [
      { label: 'Vegetarian', value: true, count: 0 },
      { label: 'Non-Vegetarian', value: false, count: 0 },
    ],
    brands,
  };
}

async function getSimilarProducts(productId, categoryId, cityId, limit = 5) {
  const actualLimit = Math.min(Math.max(1, limit), 10); // max 10
  const qtyNum = 1;

  const { rows } = await query(
    `SELECT p.id, p.name, p.slug, p.category_id, c.name AS category_name,
            p.unit, p.moq, p.stock, p.image_url, p.city_id,
            p.is_active, p.created_at, p.updated_at
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.category_id = $1
       AND p.id != $2
       AND p.is_active = true
       AND p.city_id = $3
     LIMIT $4`,
    [categoryId, productId, cityId, actualLimit]
  );

  const data = [];
  for (const row of rows) {
    data.push(await buildProductDto(row, cityId, qtyNum));
  }

  return data;
}

module.exports = { list, getById, getBySlug, getSuggestions, search, getFilters, getSimilarProducts };
