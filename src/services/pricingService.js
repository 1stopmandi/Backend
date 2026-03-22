const { pool, query } = require('../db');

const MONEY_EPS = 0.01;

class PricingUnavailableError extends Error {
  constructor(message = 'Product currently unavailable') {
    super(message);
    this.name = 'PricingUnavailableError';
    this.code = 'PRICING_UNAVAILABLE';
    this.status = 400;
  }
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function computeUnitPrice(basePrice, slabs, qty) {
  const q = Number(qty);
  const base = roundMoney(basePrice);
  if (!Number.isFinite(q) || q <= 0) return base;
  if (!slabs || slabs.length === 0) return base;
  for (const s of slabs) {
    const min = Number(s.min_qty);
    const max = s.max_qty == null ? null : Number(s.max_qty);
    if (q >= min && (max == null || q <= max)) {
      return roundMoney(s.price_per_unit);
    }
  }
  return base;
}

async function getCustomerOverridePrice(userId, productId) {
  if (!userId) return null;
  const { rows } = await query(
    `SELECT price_per_unit FROM customer_pricing
     WHERE user_id = $1 AND product_id = $2
       AND (valid_to IS NULL OR valid_to > now())
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, productId]
  );
  if (rows.length === 0) return null;
  return roundMoney(rows[0].price_per_unit);
}

async function loadActivePricingRow(productId, cityId) {
  if (cityId) {
    const r1 = await query(
      `SELECT * FROM product_pricing
       WHERE product_id = $1 AND city_id = $2
         AND valid_to IS NULL AND is_active = true AND valid_from <= now()
       LIMIT 1`,
      [productId, cityId]
    );
    if (r1.rows.length) return r1.rows[0];
  }
  const r2 = await query(
    `SELECT * FROM product_pricing
     WHERE product_id = $1 AND city_id IS NULL
       AND valid_to IS NULL AND is_active = true AND valid_from <= now()
     LIMIT 1`,
    [productId]
  );
  return r2.rows[0] || null;
}

async function loadSlabs(pricingId) {
  const { rows } = await query(
    `SELECT min_qty, max_qty, price_per_unit, sort_order
     FROM pricing_slabs WHERE pricing_id = $1 ORDER BY sort_order ASC`,
    [pricingId]
  );
  return rows.map((r) => ({
    min_qty: parseFloat(r.min_qty),
    max_qty: r.max_qty == null ? null : parseFloat(r.max_qty),
    price_per_unit: roundMoney(r.price_per_unit),
    sort_order: r.sort_order,
  }));
}

/**
 * @returns {Promise<number>}
 */
async function getPrice(productId, qty, userId, cityId) {
  const override = await getCustomerOverridePrice(userId, productId);
  if (override != null) return override;

  const row = await loadActivePricingRow(productId, cityId);
  if (!row) throw new PricingUnavailableError();

  const slabs = await loadSlabs(row.id);
  return computeUnitPrice(row.base_price, slabs, qty);
}

async function getProductPricingForApi(productId, qty, cityId) {
  const row = await loadActivePricingRow(productId, cityId);
  if (!row) {
    return {
      is_available: false,
      display_price: null,
      base_price: null,
      slabs: [],
      last_updated: null,
    };
  }
  const slabs = await loadSlabs(row.id);
  const displayQty = qty != null && !Number.isNaN(Number(qty)) ? Number(qty) : 1;
  const display_price = computeUnitPrice(row.base_price, slabs, displayQty);
  const lastUpdated = row.valid_from instanceof Date
    ? row.valid_from.toISOString()
    : row.valid_from;
  return {
    is_available: true,
    display_price,
    base_price: roundMoney(row.base_price),
    slabs,
    last_updated: lastUpdated,
  };
}

async function getPricingSnapshot(productId, cityId) {
  const row = await loadActivePricingRow(productId, cityId);
  if (!row) {
    return { base_price: 0, slabs: [] };
  }
  const slabs = await loadSlabs(row.id);
  return {
    base_price: roundMoney(row.base_price),
    slabs: slabs.map((s) => ({
      min_qty: s.min_qty,
      max_qty: s.max_qty,
      price_per_unit: s.price_per_unit,
      sort_order: s.sort_order,
    })),
  };
}

async function resolvePricesForCart(lines, cityId, userId) {
  const results = [];
  for (const line of lines) {
    const unit_price = await getPrice(line.product_id, line.quantity, userId, cityId);
    const qty = parseFloat(line.quantity);
    const line_total = roundMoney(unit_price * qty);
    let price_changed = false;
    if (line.price_at_add != null && line.price_at_add !== '') {
      price_changed = Math.abs(unit_price - Number(line.price_at_add)) > MONEY_EPS;
    }
    results.push({
      product_id: line.product_id,
      quantity: qty,
      unit_price,
      line_total,
      price_changed,
    });
  }
  return results;
}

async function resolveProductId({ productId, productSlug, cityId }) {
  if (productId) return productId;
  if (!productSlug) return null;
  if (cityId) {
    const { rows } = await query(
      `SELECT id FROM products WHERE slug = $1 AND is_active = true
       AND (city_id = $2 OR city_id IS NULL)
       ORDER BY CASE WHEN city_id IS NOT NULL THEN 0 ELSE 1 END
       LIMIT 1`,
      [productSlug, cityId]
    );
    return rows[0]?.id || null;
  }
  const { rows } = await query(
    `SELECT id FROM products WHERE slug = $1 AND is_active = true
     ORDER BY city_id NULLS FIRST
     LIMIT 1`,
    [productSlug]
  );
  return rows[0]?.id || null;
}

async function upsertPricing({ productId, productSlug, cityId, basePrice, slabs, updatedBy }) {
  let pid = productId;
  if (!pid && productSlug) {
    pid = await resolveProductId({ productSlug, cityId });
  }
  if (!pid) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const slabList = Array.isArray(slabs) ? slabs : [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: oldRows } = await client.query(
      `SELECT id FROM product_pricing
       WHERE product_id = $1
         AND valid_to IS NULL
         AND (city_id IS NOT DISTINCT FROM $2)
       FOR UPDATE`,
      [pid, cityId ?? null]
    );

    let oldSlabsJson = null;
    if (oldRows.length > 0) {
      const oldId = oldRows[0].id;
      const { rows: slabRows } = await client.query(
        `SELECT min_qty, max_qty, price_per_unit, sort_order
         FROM pricing_slabs WHERE pricing_id = $1 ORDER BY sort_order ASC`,
        [oldId]
      );
      oldSlabsJson = JSON.stringify(slabRows);
      await client.query('UPDATE product_pricing SET valid_to = now() WHERE id = $1', [oldId]);
    }

    const newSlabsJson = JSON.stringify(
      slabList.map((s, i) => ({
        min_qty: s.min_qty,
        max_qty: s.max_qty == null ? null : s.max_qty,
        price_per_unit: s.price_per_unit,
        sort_order: s.sort_order != null ? s.sort_order : i + 1,
      }))
    );

    await client.query(
      `INSERT INTO pricing_audit_log (product_id, changed_by, old_slabs, new_slabs)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
      [pid, updatedBy || null, oldSlabsJson, newSlabsJson]
    );

    const { rows: ins } = await client.query(
      `INSERT INTO product_pricing (product_id, city_id, is_active, base_price, updated_by, valid_from, valid_to)
       VALUES ($1, $2, true, $3, $4, now(), NULL)
       RETURNING *`,
      [pid, cityId ?? null, basePrice, updatedBy || null]
    );
    const newPricing = ins[0];

    let sort = 1;
    for (const s of slabList) {
      await client.query(
        `INSERT INTO pricing_slabs (pricing_id, min_qty, max_qty, price_per_unit, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          newPricing.id,
          s.min_qty,
          s.max_qty == null ? null : s.max_qty,
          s.price_per_unit,
          s.sort_order != null ? s.sort_order : sort,
        ]
      );
      sort += 1;
    }

    await client.query('COMMIT');

    const outSlabs = await loadSlabs(newPricing.id);
    return { ...newPricing, slabs: outSlabs };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function hasActivePricing(productId, cityId) {
  const row = await loadActivePricingRow(productId, cityId);
  return !!row;
}

module.exports = {
  PricingUnavailableError,
  roundMoney,
  computeUnitPrice,
  getPrice,
  getProductPricingForApi,
  getPricingSnapshot,
  resolvePricesForCart,
  upsertPricing,
  resolveProductId,
  hasActivePricing,
  loadActivePricingRow,
  loadSlabs,
};
