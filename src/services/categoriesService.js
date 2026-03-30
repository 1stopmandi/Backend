const { query } = require('../db');

// ---------- helpers ----------

function toCategoryResponse(row, includeCity = false) {
  const obj = {
    id:         row.id,
    name:       row.name,
    slug:       row.slug,
    sort_order: row.sort_order,
    city_id:    row.city_id,
  };
  if (includeCity && row.city_name) {
    obj.city = { id: row.city_id, name: row.city_name, slug: row.city_slug };
  }
  return obj;
}

function toProductResponse(row) {
  return {
    id:         row.id,
    name:       row.name,
    slug:       row.slug,
    unit:       row.unit,
    moq:        parseFloat(row.moq),
    stock:      parseFloat(row.stock),
    image_url:  row.image_url,
    city_id:    row.city_id,
    // pricing — null if no pricing row exists yet
    base_price:        row.base_price ? parseFloat(row.base_price) : null,
    lowest_slab_price: row.lowest_slab_price ? parseFloat(row.lowest_slab_price) : null,
  };
}

const SORT_MAP = {
  name:       'p.name ASC',
  price_asc:  'base_price ASC NULLS LAST',
  price_desc: 'base_price DESC NULLS LAST',
  newest:     'p.created_at DESC',
};

// ---------- service functions ----------

async function list({ cityId, citySlug, active = true } = {}) {
  // unchanged from your existing implementation
  let sql = `
    SELECT c.id, c.name, c.slug, c.sort_order, c.city_id
    FROM categories c
    WHERE c.is_active = $1
  `;
  const params = [active];

  if (cityId) {
    sql += ` AND (c.city_id = $2 OR c.city_id IS NULL)`;
    params.push(cityId);
  } else if (citySlug) {
    sql += `
      AND (c.city_id IN (SELECT id FROM cities WHERE slug = $2) OR c.city_id IS NULL)
    `;
    params.push(citySlug);
  } else {
    sql += ` AND c.city_id IS NULL`;
  }

  sql += ` ORDER BY c.sort_order ASC, c.name ASC`;
  const { rows } = await query(sql, params);
  return rows.map((r) => toCategoryResponse(r, false));
}

async function getBySlug(slug) {
  const { rows } = await query(
    `SELECT c.id, c.name, c.slug, c.sort_order, c.city_id,
            ci.name AS city_name, ci.slug AS city_slug
     FROM categories c
     LEFT JOIN cities ci ON c.city_id = ci.id
     WHERE c.slug = $1 AND c.is_active = true
     LIMIT 1`,
    [slug]
  );
  return rows.length > 0 ? toCategoryResponse(rows[0], true) : null;
}

async function getProducts({ slug, cityId, page, limit, sort, inStockOnly }) {
  // 1. Confirm category exists
  const category = await getBySlug(slug);
  if (!category) return null;

  const offset = (page - 1) * limit;
  const orderBy = SORT_MAP[sort] || SORT_MAP.name;

  // Build WHERE conditions
  const conditions = [`p.category_id = $1`, `p.is_active = true`];
  const params = [category.id];

  // City filter: show city-specific products for this city + global products
  if (cityId) {
    params.push(cityId);
    conditions.push(`(p.city_id = $${params.length} OR p.city_id IS NULL)`);
  } else {
    conditions.push(`p.city_id IS NULL`);
  }

  if (inStockOnly) {
    conditions.push(`p.stock > 0`);
  }

  const whereClause = conditions.join(' AND ');

  // 2. Count total for pagination
  const { rows: countRows } = await query(
    `SELECT COUNT(*) AS total
     FROM products p
     WHERE ${whereClause}`,
    params
  );

  // 3. Fetch products with resolved pricing via LATERAL join
  //    LATERAL: for each product, pick the most specific active pricing
  //    (city-specific wins over global), then get the lowest slab price
  const { rows } = await query(
    `SELECT
       p.id, p.name, p.slug, p.unit, p.moq, p.stock, p.image_url, p.city_id,
       pricing.base_price,
       slabs.lowest_slab_price
     FROM products p

     -- Resolve best active pricing: city-specific first, fall back to global
     LEFT JOIN LATERAL (
       SELECT pp.base_price
       FROM product_pricing pp
       WHERE pp.product_id = p.id
         AND pp.is_active   = true
         AND pp.valid_to    IS NULL
         AND (${cityId ? `pp.city_id = $${params.length} OR` : ''} pp.city_id IS NULL)
       ORDER BY (pp.city_id IS NOT NULL) DESC   -- city-specific rows sort first
       LIMIT 1
     ) pricing ON true

     -- Lowest slab price for this pricing row (shown as "from ₹X")
     LEFT JOIN LATERAL (
       SELECT MIN(ps.price_per_unit) AS lowest_slab_price
       FROM product_pricing pp2
       JOIN pricing_slabs ps ON ps.pricing_id = pp2.id
       WHERE pp2.product_id = p.id
         AND pp2.is_active = true
         AND pp2.valid_to IS NULL
         AND (${cityId ? `pp2.city_id = $${params.length} OR` : ''} pp2.city_id IS NULL)
     ) slabs ON true

     WHERE ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    category,
    data:        rows.map(toProductResponse),
    total:       Number(countRows[0].total),
    page,
    limit,
    total_pages: Math.ceil(Number(countRows[0].total) / limit),
  };
}

module.exports = { list, getBySlug, getProducts };