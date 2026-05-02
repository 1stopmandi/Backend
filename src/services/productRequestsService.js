const { query } = require('../db');

const ALLOWED_FREQUENCIES = new Set(['one_time', 'daily', 'weekly', 'monthly']);

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num;
}

function toResponse(row) {
  return {
    id: row.id,
    name: row.name,
    category_id: row.category_id,
    category_name: row.category_name ?? null,
    expected_qty: row.expected_qty !== null ? parseFloat(row.expected_qty) : null,
    unit: row.unit,
    expected_price: row.expected_price !== null ? parseFloat(row.expected_price) : null,
    purchase_frequency: row.purchase_frequency,
    notes: row.notes,
    image_url: row.image_url,
    status: row.status,
    admin_note: row.admin_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function create(userId, payload = {}) {
  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('name is required');
    err.status = 400;
    throw err;
  }

  if (name.length > 200) {
    const err = new Error('name cannot exceed 200 characters');
    err.status = 400;
    throw err;
  }

  const purchaseFrequency = payload.purchase_frequency || null;
  if (purchaseFrequency && !ALLOWED_FREQUENCIES.has(purchaseFrequency)) {
    const err = new Error('purchase_frequency must be one of one_time, daily, weekly, monthly');
    err.status = 400;
    throw err;
  }

  if (payload.category_id) {
    const { rows: categoryRows } = await query(
      'SELECT 1 FROM categories WHERE id = $1 AND is_active = true',
      [payload.category_id]
    );
    if (categoryRows.length === 0) {
      const err = new Error('Invalid category_id');
      err.status = 400;
      throw err;
    }
  }

  const expectedQty = parseNumber(payload.expected_qty);
  const expectedPrice = parseNumber(payload.expected_price);
  if (payload.expected_qty !== undefined && expectedQty === null) {
    const err = new Error('expected_qty must be a valid number');
    err.status = 400;
    throw err;
  }
  if (payload.expected_price !== undefined && expectedPrice === null) {
    const err = new Error('expected_price must be a valid number');
    err.status = 400;
    throw err;
  }

  const { rows } = await query(
    `INSERT INTO product_requests (
      user_id, name, category_id, expected_qty, unit, expected_price,
      purchase_frequency, notes, image_url
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, user_id, name, category_id, expected_qty, unit, expected_price,
      purchase_frequency, notes, image_url, status, admin_note, created_at, updated_at`,
    [
      userId,
      name,
      payload.category_id || null,
      expectedQty,
      payload.unit ? String(payload.unit).trim() : null,
      expectedPrice,
      purchaseFrequency,
      payload.notes ? String(payload.notes).trim() : null,
      payload.image_url || null,
    ]
  );

  return toResponse(rows[0]);
}

async function listByUser(userId) {
  const { rows } = await query(
    `SELECT pr.id, pr.name, pr.category_id, c.name AS category_name, pr.expected_qty, pr.unit,
            pr.expected_price, pr.purchase_frequency, pr.notes, pr.image_url, pr.status,
            pr.admin_note, pr.created_at, pr.updated_at
     FROM product_requests pr
     LEFT JOIN categories c ON c.id = pr.category_id
     WHERE pr.user_id = $1
     ORDER BY pr.created_at DESC`,
    [userId]
  );
  return rows.map(toResponse);
}

module.exports = {
  create,
  listByUser,
};
