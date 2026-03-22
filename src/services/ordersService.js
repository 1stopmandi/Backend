const { pool, query } = require('../db');
const cartService = require('./cartService');

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
  const cart = await cartService.getCart(userId);
  if (!cart.items || cart.items.length === 0) {
    const err = new Error('Cart is empty');
    err.status = 400;
    throw err;
  }

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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderNumber = await generateOrderNumber(client);
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (user_id, order_number, status, source, saved_list_id, uploaded_order_id, total_amount)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6)
       RETURNING id, order_number, status, source, saved_list_id, uploaded_order_id, total_amount, created_at`,
      [userId, orderNumber, source, finalSavedListId, finalUploadedOrderId, cart.total]
    );
    const order = orderRows[0];

    for (const item of cart.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit, price_per_unit, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          item.product_id,
          item.product_name,
          item.unit,
          item.price_per_unit,
          item.quantity,
          item.line_total,
        ]
      );
    }

    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toOrderItemResponse(row) {
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: row.product_name,
    unit: row.unit,
    price_per_unit: parseFloat(row.price_per_unit),
    quantity: parseFloat(row.quantity),
    line_total: parseFloat(row.line_total),
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
    `SELECT id, order_number, status, source, saved_list_id, uploaded_order_id, total_amount, created_at, updated_at
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
    `SELECT id, order_number, status, source, saved_list_id, uploaded_order_id, total_amount, created_at, updated_at
     FROM orders WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (orderRows.length === 0) return null;

  const { rows: itemRows } = await query(
    `SELECT id, product_id, product_name, unit, price_per_unit, quantity, line_total
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
    `SELECT id, order_number, status, source, saved_list_id, uploaded_order_id, total_amount, created_at, updated_at
     FROM orders
     WHERE user_id = $1
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
    } catch (e) {
      // Skip discontinued/out-of-stock products
    }
  }

  return cartService.getCart(userId);
}

module.exports = {
  createFromCart,
  list,
  getById,
  getLastOrder,
  addLastOrderToCart,
};
