const pricingService = require('../services/pricingService');
const { query }      = require('../db');

// existing — unchanged
async function updatePricing(req, res) {
  const { product_id, slug, city_id, base_price, slabs } = req.body;

  if (base_price == null || Number.isNaN(Number(base_price))) {
    const err = new Error('base_price is required');
    err.status = 400;
    throw err;
  }
  if (!product_id && !slug) {
    const err = new Error('product_id or slug is required');
    err.status = 400;
    throw err;
  }

  const result = await pricingService.upsertPricing({
    productId:   product_id || null,
    productSlug: slug       || null,
    cityId:      city_id    ?? null,
    basePrice:   Number(base_price),
    slabs:       slabs || [],
    updatedBy:   req.user?.id || null,
  });

  res.json({
    success: true,
    data: {
      id:         result.id,
      product_id: result.product_id,
      city_id:    result.city_id,
      base_price: parseFloat(result.base_price),
      valid_from: result.valid_from,
      slabs:      result.slabs,
    },
  });
}

// get current active pricing for a product
async function getByProduct(req, res) {
  const { productId } = req.params;
  const { city_id: cityId } = req.query;

  const row = await pricingService.loadActivePricingRow(productId, cityId || null);
  if (!row) {
    return res.json({
      success: true,
      data: { product_id: productId, is_active: false, pricing: null },
    });
  }

  const slabs = await pricingService.loadSlabs(row.id);
  res.json({
    success: true,
    data: {
      id:         row.id,
      product_id: row.product_id,
      city_id:    row.city_id,
      base_price: parseFloat(row.base_price),
      valid_from: row.valid_from,
      is_active:  row.is_active,
      slabs,
    },
  });
}

// full audit trail for a product
async function getAuditLog(req, res) {
  const { productId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  const { rows } = await query(
    `SELECT pal.id, pal.product_id, pal.old_slabs, pal.new_slabs,
            pal.changed_at,
            u.name AS changed_by_name, u.phone AS changed_by_phone
     FROM pricing_audit_log pal
     LEFT JOIN users u ON u.id = pal.changed_by
     WHERE pal.product_id = $1
     ORDER BY pal.changed_at DESC
     LIMIT $2 OFFSET $3`,
    [productId, parseInt(limit), offset]
  );

  const { rows: countRows } = await query(
    'SELECT COUNT(*)::int AS total FROM pricing_audit_log WHERE product_id = $1',
    [productId]
  );

  res.json({
    success: true,
    data: rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: countRows[0].total,
      total_pages: Math.ceil(countRows[0].total / parseInt(limit)),
    },
  });
}

// products with NO active pricing — admin dashboard use case
async function listProducts(req, res) {
  const { city_id: cityId, unpriced_only } = req.query;

  if (unpriced_only === 'true') {
    // products that have no active global pricing row
    const { rows } = await query(
      `SELECT p.id, p.name, p.slug, p.city_id,
              c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = true
         AND NOT EXISTS (
           SELECT 1 FROM product_pricing pp
           WHERE pp.product_id = p.id
             AND pp.valid_to IS NULL
             AND pp.is_active = true
         )
       ORDER BY c.name ASC, p.name ASC`
    );
    return res.json({ success: true, data: rows, total: rows.length });
  }

  // all products with their current pricing summary
  const { rows } = await query(
    `SELECT p.id, p.name, p.slug,
            c.name AS category_name,
            pp.base_price,
            pp.city_id AS pricing_city_id,
            pp.valid_from,
            (SELECT COUNT(*)::int FROM pricing_slabs ps WHERE ps.pricing_id = pp.id) AS slab_count
     FROM products p
     LEFT JOIN categories c   ON c.id  = p.category_id
     LEFT JOIN product_pricing pp ON pp.product_id = p.id
       AND pp.valid_to IS NULL
       AND pp.is_active = true
       AND (pp.city_id = $1 OR pp.city_id IS NULL)
     WHERE p.is_active = true
     ORDER BY c.name ASC, p.name ASC`,
    [cityId || null]
  );

  res.json({ success: true, data: rows, total: rows.length });
}

// deactivate current pricing (sets valid_to = now)
async function deactivatePricing(req, res) {
  const { productId } = req.params;
  const { city_id: cityId } = req.query;

  const { rowCount } = await query(
    `UPDATE product_pricing
     SET valid_to = now(), is_active = false, updated_at = now()
     WHERE product_id = $1
       AND (city_id IS NOT DISTINCT FROM $2)
       AND valid_to IS NULL
       AND is_active = true`,
    [productId, cityId || null]
  );

  if (rowCount === 0) {
    const err = new Error('No active pricing found for this product');
    err.status = 404;
    throw err;
  }

  // log the deactivation
  await query(
    `INSERT INTO pricing_audit_log (product_id, changed_by, old_slabs, new_slabs)
     SELECT $1, $2, old_slabs, '[]'::jsonb
     FROM pricing_audit_log
     WHERE product_id = $1
     ORDER BY changed_at DESC LIMIT 1`,
    [productId, req.user?.id || null]
  );

  res.json({ success: true, message: 'Pricing deactivated' });
}

module.exports = {
  updatePricing,
  getByProduct,
  getAuditLog,
  listProducts,
  deactivatePricing,
};