const { pool, query } = require('../db');
const cartService = require('./cartService');
const pricingService = require('./pricingService');

async function create(userId, imageUrl) {
  const { rows } = await query(
    `INSERT INTO uploaded_orders (user_id, image_url, status)
     VALUES ($1, $2, 'processing')
     RETURNING id, user_id, image_url, status, created_at, updated_at`,
    [userId, imageUrl]
  );
  return rows[0];
}

async function listByUser(userId) {
  const { rows } = await query(
    `SELECT id, image_url, status, cart_ready_at, created_at, updated_at
     FROM uploaded_orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    image_url: r.image_url,
    status: r.status,
    cart_ready_at: r.cart_ready_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

async function getById(id, userId) {
  const { rows: orderRows } = await query(
    `SELECT id, user_id, image_url, status, cart_ready_at, notes, created_at, updated_at
     FROM uploaded_orders WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (orderRows.length === 0) return null;

  const order = orderRows[0];
  const result = {
    id: order.id,
    image_url: order.image_url,
    status: order.status,
    cart_ready_at: order.cart_ready_at,
    notes: order.notes,
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: [],
  };

  if (order.status === 'ready') {
    const { rows: urows } = await query(
      'SELECT city_id FROM users WHERE id = $1',
      [order.user_id]
    );
    const cityId = urows[0]?.city_id ?? null;

    const { rows: itemRows } = await query(
      `SELECT uoi.id, uoi.product_id, uoi.quantity,
              p.name AS product_name, p.unit, p.moq, p.stock
       FROM uploaded_order_items uoi
       JOIN products p ON uoi.product_id = p.id
       WHERE uoi.uploaded_order_id = $1 AND p.is_active = true`,
      [id]
    );

    for (const r of itemRows) {
      const qty = parseFloat(r.quantity);
      const pricing = await pricingService.getProductPricingForApi(
        r.product_id,
        qty,
        cityId
      );
      const unit = pricing.is_available ? pricing.display_price : null;
      result.items.push({
        id: r.id,
        product_id: r.product_id,
        product_name: r.product_name,
        unit: r.unit,
        quantity: qty,
        price_per_unit: unit,
        pricing_available: pricing.is_available,
        moq: parseFloat(r.moq),
        stock: parseFloat(r.stock ?? 0),
        line_total:
          unit != null
            ? pricingService.roundMoney(unit * qty)
            : null,
      });
    }
  }

  return result;
}

async function addToCart(id, userId, { merge = false } = {}) {
  const order = await getById(id, userId);
  if (!order) return null;
  if (order.status !== 'ready') {
    const err = new Error('Order is not ready yet');
    err.status = 400;
    throw err;
  }
  if (!order.items || order.items.length === 0) {
    const err = new Error('No items to add to cart');
    err.status = 400;
    throw err;
  }

  if (!merge) {
    await cartService.clearCart(userId);   // only clear if not merging
  }

  for (const item of order.items) {
    try {
      await cartService.addItem(userId, item.product_id, item.quantity);
    } catch { /* skip */ }
  }

  return cartService.getCart(userId);
}

async function listByStatus(status) {
  const { rows } = await query(
    `SELECT uo.id, uo.user_id, uo.image_url, uo.status, uo.created_at,
            u.phone, u.name
     FROM uploaded_orders uo
     JOIN users u ON uo.user_id = u.id
     WHERE uo.status = $1
     ORDER BY uo.created_at ASC`,
    [status]
  );
  return rows;
}

async function markReady(id, adminUserId, { items, notes }) {
  const { rows: orderRows } = await query(
    'SELECT id, user_id FROM uploaded_orders WHERE id = $1 AND status = $2',
    [id, 'processing']
  );
  if (orderRows.length === 0) {
    const err = new Error('Upload not found or already processed');
    err.status = 404;
    throw err;
  }
  const userId = orderRows[0].user_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE uploaded_orders SET status = 'ready', cart_ready_at = now(),
       processed_by = $1, notes = $2, updated_at = now()
       WHERE id = $3`,
      [adminUserId, notes || null, id]
    );

    if (items && Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const productId = it.product_id;
        const qty = parseFloat(it.quantity) || 1;
        if (productId && qty > 0) {
          await client.query(
            `INSERT INTO uploaded_order_items (uploaded_order_id, product_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (uploaded_order_id, product_id) DO UPDATE SET quantity = $3`,
            [id, productId, qty]
          );
        }
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  return getById(id, userId);
}

async function markRejected(id, adminUserId, { notes }) {
  const res = await query(
    `UPDATE uploaded_orders SET status = 'rejected', processed_by = $1, notes = $2, updated_at = now()
     WHERE id = $3 AND status = 'processing'
     RETURNING id`,
    [adminUserId, notes || null, id]
  );
  return res.rowCount > 0;
}

// service
async function deleteUpload(id, userId) {
  // only allow delete if not in 'processing' state
  // — can't delete while admin is actively working on it
  const { rows } = await query(
    'SELECT status FROM uploaded_orders WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  if (rows.length === 0) return false;

  if (rows[0].status === 'processing') {
    const err = new Error('Cannot delete an upload while it is being processed');
    err.status = 400;
    throw err;
  }

  const { rowCount } = await query(
    'DELETE FROM uploaded_orders WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = {
  create,
  listByUser,
  getById,
  addToCart,
  deleteUpload,
  listByStatus,
  markReady,
  markRejected,
};
