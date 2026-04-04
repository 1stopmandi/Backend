const { pool, query } = require('../db');
const cartService = require('./cartService');
const pricingService = require('./pricingService');
const PDFDocument = require('pdfkit');

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
    'SELECT city_id, address, pincode FROM users WHERE id = $1',
    [userId]
  );
  const cityId = userRows[0]?.city_id ?? null;
  const deliveryAddress = userRows[0]?.address ?? null;   // new
  const deliveryPincode = userRows[0]?.pincode ?? null;

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
     total_amount, price_changed_at_checkout,
     delivery_address, delivery_pincode, delivery_city_id    -- new
   )
   VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10)
   RETURNING *`,
      [
        userId, orderNumber, source,
        finalSavedListId, finalUploadedOrderId,
        totalAmount, priceChangedAtCheckout,
        deliveryAddress, deliveryPincode, cityId,               // new
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
    id:                       row.id,
    order_number:             row.order_number,
    status:                   row.status,
    source:                   row.source,
    saved_list_id:            row.saved_list_id            ?? null,
    uploaded_order_id:        row.uploaded_order_id        ?? null,
    total_amount:             parseFloat(row.total_amount  ?? 0),
    price_changed_at_checkout: row.price_changed_at_checkout === true,
    delivery_address:         row.delivery_address         ?? null,   // new
    delivery_pincode:         row.delivery_pincode         ?? null,   // new
    delivery_city_id:         row.delivery_city_id         ?? null,   // new
    created_at:               row.created_at,
    updated_at:               row.updated_at,
  };
}

function toOrderItemResponse(row) {
  let snapshot = row.pricing_slab_snapshot;
  if (typeof snapshot === 'string') {
    try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; }
  }
  return {
    id: row.id,
    product_id: row.product_id,
    product_name: row.product_name,
    product_slug: row.slug || null,   // new
    image_url: row.image_url || null,   // new
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
    `SELECT oi.id, oi.product_id, oi.product_name, oi.unit,
          oi.price_applied, oi.quantity, oi.line_total,
          oi.pricing_slab_snapshot,
          p.image_url, p.slug          -- add these two
   FROM order_items oi
   LEFT JOIN products p ON p.id = oi.product_id   -- add this join
   WHERE oi.order_id = $1
   ORDER BY oi.created_at`,
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

async function cancelOrder(orderId, userId) {
  // confirm order belongs to this user
  const { rows } = await query(
    'SELECT id, status FROM orders WHERE id = $1 AND user_id = $2',
    [orderId, userId]
  );
  if (rows.length === 0) return null;

  const current = rows[0].status;
  const cancellable = STATUS_TRANSITIONS[current];

  if (!cancellable || !cancellable.has('cancelled')) {
    const err = new Error(
      `Cannot cancel an order that is already ${current}`
    );
    err.status = 400;
    err.code = 'INVALID_STATUS_TRANSITION';
    throw err;
  }

  await query(
    'UPDATE orders SET status = $1, updated_at = now() WHERE id = $2',
    ['cancelled', orderId]
  );

  // trigger in 018 migration auto-inserts tracking row
  return getById(orderId, userId);
}

async function reorderById(orderId, userId) {
  // fetch the specific order — not just the last one
  const { rows: orderRows } = await query(
    'SELECT id FROM orders WHERE id = $1 AND user_id = $2',
    [orderId, userId]
  );
  if (orderRows.length === 0) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  const { rows: itemRows } = await query(
    'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
    [orderId]
  );
  if (itemRows.length === 0) {
    const err = new Error('Order has no items');
    err.status = 400;
    throw err;
  }

  await cartService.clearCart(userId);

  for (const item of itemRows) {
    try {
      await cartService.addItem(userId, item.product_id, parseFloat(item.quantity));
    } catch {
      // skip items that are now out of stock or discontinued
    }
  }

  return cartService.getCart(userId);
}

async function getTracking(orderId, userId) {
  // verify order ownership
  const { rows: orderRows } = await query(
    `SELECT id, order_number, status, created_at
     FROM orders WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (orderRows.length === 0) return null;

  const { rows: trackingRows } = await query(
    `SELECT status, note, location, created_at
     FROM order_delivery_tracking
     WHERE order_id = $1
     ORDER BY created_at ASC`,
    [orderId]
  );

  // if no tracking rows yet, synthesise one from order creation
  const timeline = trackingRows.length > 0
    ? trackingRows
    : [{
      status: 'pending',
      note: 'Order placed',
      location: null,
      created_at: orderRows[0].created_at,
    }];

  return {
    order_id: orderRows[0].id,
    order_number: orderRows[0].order_number,
    status: orderRows[0].status,
    timeline,
  };
}

async function generateInvoice(orderId, userId) {
  const order = await getById(orderId, userId);
  if (!order) return { stream: null, filename: null };

  // fetch buyer details for invoice header
  const { rows: userRows } = await query(
    `SELECT name, phone, business_name, address, pincode,
            gst_number, fssai_number
     FROM users WHERE id = $1`,
    [userId]
  );
  const user = userRows[0] || {};

  const doc = new PDFDocument({ margin: 50 });
  const filename = `invoice-${order.order_number}.pdf`;

  // header
  doc.fontSize(20).text('1StopMandi', { align: 'left' });
  doc.fontSize(10).fillColor('#666')
    .text('Fresh produce for restaurants', { align: 'left' });
  doc.moveDown();

  doc.fontSize(14).fillColor('#000').text('TAX INVOICE', { align: 'right' });
  doc.fontSize(10).fillColor('#444')
    .text(`Invoice #: ${order.order_number}`, { align: 'right' })
    .text(`Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}`, { align: 'right' });

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ddd');
  doc.moveDown(0.5);

  // buyer info
  doc.fontSize(10).fillColor('#000')
    .text(`Bill To: ${user.business_name || user.name || 'N/A'}`)
    .text(`Contact: ${user.phone || ''}`)
    .text(`Address: ${user.address || ''}, ${user.pincode || ''}`)
    .text(`GSTIN: ${user.gst_number || 'N/A'}`)
    .text(`FSSAI: ${user.fssai_number || 'N/A'}`);

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ddd');
  doc.moveDown(0.5);

  // items table header
  const col = { item: 50, unit: 270, qty: 330, price: 390, total: 470 };
  doc.fontSize(9).fillColor('#444')
    .text('Item', col.item, doc.y, { width: 200 })
    .text('Unit', col.unit, doc.y - doc.currentLineHeight(), { width: 55 })
    .text('Qty', col.qty, doc.y - doc.currentLineHeight(), { width: 55 })
    .text('Rate (₹)', col.price, doc.y - doc.currentLineHeight(), { width: 75 })
    .text('Total (₹)', col.total, doc.y - doc.currentLineHeight(), { width: 75 });

  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
  doc.moveDown(0.3);

  // items rows
  doc.fontSize(10).fillColor('#000');
  for (const item of order.items) {
    const y = doc.y;
    doc.text(item.product_name, col.item, y, { width: 210 })
      .text(item.unit, col.unit, y, { width: 55 })
      .text(String(item.quantity), col.qty, y, { width: 55 })
      .text(item.price_applied.toFixed(2), col.price, y, { width: 75 })
      .text(item.line_total.toFixed(2), col.total, y, { width: 75 });
    doc.moveDown(0.3);
  }

  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
  doc.moveDown(0.5);

  // total
  doc.fontSize(11).text(
    `Total Amount: ₹${order.total_amount.toFixed(2)}`,
    { align: 'right' }
  );

  if (order.price_changed_at_checkout) {
    doc.moveDown(0.5).fontSize(9).fillColor('#cc0000')
      .text('* Prices were updated at checkout', { align: 'right' });
  }

  doc.moveDown(2).fontSize(9).fillColor('#888')
    .text('Thank you for ordering with 1StopMandi!', { align: 'center' });

  doc.end();
  return { stream: doc, filename };
}

// update module.exports to include new functions
module.exports = {
  createFromCart,
  list,
  getById,
  getLastOrder,
  addLastOrderToCart,
  updateStatusByAdmin,
  cancelOrder,       // new
  reorderById,       // new
  getTracking,       // new
  generateInvoice,   // new
};
