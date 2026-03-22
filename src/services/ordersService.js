const { pool, query } = require('../db');
const cartService = require('./cartService');
const pricingService = require('./pricingService');

const STATUS_TRANSITIONS = {
  pending: new Set(['confirmed', 'cancelled']),
  confirmed: new Set(['out_for_delivery', 'cancelled']),
  out_for_delivery: new Set(['delivered', 'cancelled']),
  delivered: new Set(),
  cancelled: new Set(),
};

async function generateOrderNumber(client) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM orders
     WHERE created_at >= date_trunc('day', now())`
  );
  const seq = (rows[0]?.n ?? 0) + 1;
  return `ORD-${date}-${String(seq).padStart(3, '0')}`;
}

async function createFromCart(userId, { saved_list_id, uploaded_order_id } = {}) {
  let source = 'normal';
  let finalSavedListId = null;
  let finalUploadedOrderId = null;

  if (saved_list_id && uploaded_order_id) {
    const err = new Error('Provide only one of saved_list_id or uploaded_order_id');
    err.status = 400;
    throw err;
  }

  if (saved_list_id) {
    const { rows } = await query(
      'SELECT id FROM saved_lists WHERE id = $1 AND user_id = $2',
      [saved_list_id, userId]
    );
    if (rows.length === 0) {
      const err = new Error('Saved list not found');
      err.status = 404;
      throw err;
    }
    source = 'regular_list';
    finalSavedListId = saved_list_id;
  } else if (uploaded_order_id) {
    const { rows } = await query(
      'SELECT id FROM uploaded_orders WHERE id = $1 AND user_id = $2 AND status = $3',
      [uploaded_order_id, userId, 'ready']
    );
    if (rows.length === 0) {
      const err = new Error('Uploaded order not found or not ready');
      err.status = 404;
      throw err;
    }
    source = 'uploaded';
    finalUploadedOrderId = uploaded_order_id;
  }

  const { rows: userRows } = await query(
    'SELECT city_id FROM users WHERE id = $1',
    [userId]
  );
  const cityId = userRows[0]?.city_id ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: cartRows } = await client.query(
      'SELECT id FROM carts WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    if (cartRows.length === 0) {
      const err = new Error('Cart is empty');
      err.status = 400;
      throw err;
    }
    const cartId = cartRows[0].id;

    const { rows: itemRows } = await client.query(
      `SELECT ci.product_id, ci.quantity, ci.price_at_add,
              p.name AS product_name, p.unit
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    if (itemRows.length === 0) {
      const err = new Error('Cart is empty');
      err.status = 400;
      throw err;
    }

    let priceChangedAtCheckout = false;
    const linePayloads = [];

    for (const row of itemRows) {
      const qty = parseFloat(row.quantity);
      const unitPrice = await pricingService.getPrice(
        row.product_id,
        qty,
        userId,
        cityId
      );
      const snapshot = await pricingService.getPricingSnapshot(
        row.product_id,
        cityId
      );
      const lineTotal = pricingService.roundMoney(unitPrice * qty);

      if (row.price_at_add != null) {
        const atAdd = parseFloat(row.price_at_add);
        if (Math.abs(unitPrice - atAdd) > 0.01) {
          priceChangedAtCheckout = true;
        }
      }

      linePayloads.push({
        product_id: row.product_id,
        product_name: row.product_name,
        unit: row.unit,
        quantity: qty,
        price_applied: unitPrice,
        line_total: lineTotal,
        pricing_slab_snapshot: JSON.stringify(snapshot),
      });
    }

    const totalAmount = pricingService.roundMoney(
      linePayloads.reduce((s, l) => s + l.line_total, 0)
    );

    const orderNumber = await generateOrderNumber(client);
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (
         user_id, order_number, status, source, saved_list_id, uploaded_order_id,
         total_amount, price_changed_at_checkout
       )
       VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7)
       RETURNING id, order_number, status, source, saved_list_id, uploaded_order_id,
         total_amount, price_changed_at_checkout, created_at, updated_at`,
      [
        userId,
        orderNumber,
        source,
        finalSavedListId,
        finalUploadedOrderId,
        totalAmount,
        priceChangedAtCheckout,
      ]
    );
    const order = orderRows[0];

    for (const line of linePayloads) {
      await client.query(
        `INSERT INTO order_items (
           order_id, product_id, product_name, unit, quantity,
           price_applied, line_total, pricing_slab_snapshot
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          order.id,
          line.product_id,
          line.product_name,
          line.unit,
          line.quantity,
          line.price_applied,
          line.line_total,
          line.pricing_slab_snapshot,
        ]
      );
    }

    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    await client.query('COMMIT');

    return getById(order.id, userId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function toOrderResponse(row) {
  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    source: row.source,
    saved_list_id: row.saved_list_id ?? null,
    uploaded_order_id: row.uploaded_order_id ?? null,
    total_amount: parseFloat(row.total_amount ?? 0),
    price_changed_at_checkout: row.price_changed_at_checkout === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toOrderItemResponse(row) {
  let snapshot = row.pricing_slab_snapshot;
  if (typeof snapshot === 'string') {
    try {
      snapshot = JSON.parse(snapshot);
    } catch {
      snapshot = null;
    }
  }
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: row.product_name,
    unit: row.unit,
    price_applied: parseFloat(row.price_applied),
    quantity: parseFloat(row.quantity),
    line_total: parseFloat(row.line_total),
    pricing_slab_snapshot: snapshot,
  };
}

async function list(userId, { page = 1, limit = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const actualLimit = Math.min(Math.max(1, limit), 100);

  const { rows: countRows } = await query(
    'SELECT COUNT(*)::int AS count FROM orders WHERE user_id = $1',
    [userId]
  );
  const total = parseInt(countRows[0]?.count ?? 0, 10);

  const { rows } = await query(
    `SELECT id, order_number, status, source, saved_list_id, uploaded_order_id,
            total_amount, price_changed_at_checkout, created_at, updated_at
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, actualLimit, offset]
  );

  return {
    data: rows.map(toOrderResponse),
    pagination: {
      page: Math.floor(offset / actualLimit) + 1,
      limit: actualLimit,
      total,
      totalPages: Math.ceil(total / actualLimit) || 1,
    },
  };
}

async function getById(orderId, userId) {
  const { rows: orderRows } = await query(
    `SELECT id, order_number, status, source, saved_list_id, uploaded_order_id,
            total_amount, price_changed_at_checkout, created_at, updated_at
     FROM orders WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (orderRows.length === 0) return null;

  const { rows: itemRows } = await query(
    `SELECT id, product_id, product_name, unit, price_applied, quantity, line_total,
            pricing_slab_snapshot
     FROM order_items WHERE order_id = $1 ORDER BY created_at`,
    [orderId]
  );

  return {
    ...toOrderResponse(orderRows[0]),
    items: itemRows.map(toOrderItemResponse),
  };
}

async function getLastOrder(userId) {
  const { rows: orderRows } = await query(
    `SELECT id, order_number, status, source, saved_list_id, uploaded_order_id,
            total_amount, price_changed_at_checkout, created_at, updated_at
     FROM orders
     WHERE user_id = $1 AND status = 'delivered'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  if (orderRows.length === 0) return null;

  const orderId = orderRows[0].id;
  const { rows: itemRows } = await query(
    `SELECT product_id, product_name, unit, quantity
     FROM order_items WHERE order_id = $1`,
    [orderId]
  );

  return {
    ...toOrderResponse(orderRows[0]),
    items: itemRows.map((r) => ({
      product_id: r.product_id,
      product_name: r.product_name,
      unit: r.unit,
      quantity: parseFloat(r.quantity),
    })),
  };
}

async function addLastOrderToCart(userId) {
  const lastOrder = await getLastOrder(userId);
  if (!lastOrder || !lastOrder.items || lastOrder.items.length === 0) {
    const err = new Error('No previous order found to repeat');
    err.status = 404;
    throw err;
  }

  await cartService.clearCart(userId);

  for (const item of lastOrder.items) {
    try {
      await cartService.addItem(userId, item.product_id, item.quantity);
    } catch {
      // Skip discontinued/out-of-stock/unpriced
    }
  }

  return cartService.getCart(userId);
}

async function updateStatusByAdmin(orderId, newStatus) {
  const { rows } = await query(
    'SELECT id, status FROM orders WHERE id = $1',
    [orderId]
  );
  if (rows.length === 0) return null;

  const cur = rows[0].status;
  const allowed = STATUS_TRANSITIONS[cur];
  if (!allowed || !allowed.has(newStatus)) {
    const err = new Error(`Invalid status transition from ${cur} to ${newStatus}`);
    err.status = 400;
    err.code = 'INVALID_STATUS_TRANSITION';
    throw err;
  }

  await query(
    'UPDATE orders SET status = $1, updated_at = now() WHERE id = $2',
    [newStatus, orderId]
  );

  const { rows: full } = await query(
    `SELECT id, order_number, status, source, total_amount, price_changed_at_checkout,
            created_at, updated_at
     FROM orders WHERE id = $1`,
    [orderId]
  );
  return toOrderResponse(full[0]);
}

module.exports = {
  createFromCart,
  list,
  getById,
  getLastOrder,
  addLastOrderToCart,
  updateStatusByAdmin,
};
