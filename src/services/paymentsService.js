const { pool } = require('../db');
const pricingService = require('./pricingService');
const inventoryService = require('./inventoryService');
const { Cashfree, CFEnvironment } = require('cashfree-pg');

let cashfreeSingleton = null;

/**
 * Lazy-initialise Cashfree PG SDK (v5 constructor pattern).
 * @returns {import('cashfree-pg').Cashfree}
 */
function getCashfree() {
  if (cashfreeSingleton) return cashfreeSingleton;

  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || String(clientId).trim() === '') {
    const err = new Error('[Payments] CASHFREE_CLIENT_ID is missing');
    err.status = 500;
    throw err;
  }
  if (!clientSecret || String(clientSecret).trim() === '') {
    const err = new Error('[Payments] CASHFREE_CLIENT_SECRET is missing');
    err.status = 500;
    throw err;
  }

  const env =
    process.env.CASHFREE_ENV === 'production'
      ? CFEnvironment.PRODUCTION
      : CFEnvironment.SANDBOX;

  cashfreeSingleton = new Cashfree(env, clientId, clientSecret);
  return cashfreeSingleton;
}

/**
 * Price the current cart inside a transaction (same logic as order placement).
 * @param {import('pg').PoolClient} client
 * @param {string} userId
 */
async function priceCart(client, userId) {
  const { rows: userRows } = await client.query(
    'SELECT city_id, address, pincode FROM users WHERE id = $1',
    [userId]
  );
  const cityId = userRows[0]?.city_id ?? null;

  const { rows: cartRows } = await client.query(
    'SELECT id FROM carts WHERE user_id = $1 FOR UPDATE',
    [userId]
  );
  if (cartRows.length === 0) {
    const err = new Error('Cart is empty');
    err.status = 400;
    err.code = 'EMPTY_CART';
    throw err;
  }
  const cartId = cartRows[0].id;

  const { rows: items } = await client.query(
    `SELECT ci.product_id, ci.quantity, ci.price_at_add,
            p.name AS product_name, p.unit
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.cart_id = $1`,
    [cartId]
  );

  if (items.length === 0) {
    const err = new Error('Cart is empty');
    err.status = 400;
    err.code = 'EMPTY_CART';
    throw err;
  }

  const lines = items.map((row) => ({
    product_id: row.product_id,
    quantity: parseFloat(row.quantity),
    price_at_add: row.price_at_add != null ? parseFloat(row.price_at_add) : null,
  }));

  const resolved = await pricingService.resolvePricesForCart(lines, cityId, userId);

  const linePayloads = [];
  let priceChangedAtCheckout = false;
  for (let i = 0; i < items.length; i++) {
    const row = items[i];
    const r = resolved[i];
    if (r.price_changed) priceChangedAtCheckout = true;
    const snapshot = await pricingService.getPricingSnapshot(row.product_id, cityId);
    linePayloads.push({
      product_id: row.product_id,
      product_name: row.product_name,
      unit: row.unit,
      quantity: r.quantity,
      price_applied: r.unit_price,
      line_total: r.line_total,
      pricing_slab_snapshot: JSON.stringify(snapshot),
      price_changed: r.price_changed,
    });
  }

  const totalAmount = pricingService.roundMoney(
    linePayloads.reduce((s, l) => s + l.line_total, 0)
  );

  return {
    items: linePayloads,
    totalAmount,
    priceChangedAtCheckout,
    cartId,
    cityId,
    deliveryAddress: userRows[0]?.address ?? null,
    deliveryPincode: userRows[0]?.pincode ?? null,
  };
}

async function generateOrderNumber(client) {
  await client.query(
    `SELECT pg_advisory_xact_lock(
       88422,
       hashtext(to_char(date_trunc('day', now()), 'YYYYMMDD'))
     )`
  );
  const { rows: dr } = await client.query(
    `SELECT to_char(date_trunc('day', now()), 'YYYYMMDD') AS ymd`
  );
  const date = dr[0].ymd;
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM orders
     WHERE created_at >= date_trunc('day', now())`
  );
  const seq = (rows[0]?.n ?? 0) + 1;
  return `ORD-${date}-${String(seq).padStart(3, '0')}`;
}

/**
 * Snapshot cart + create Cashfree order.
 * @param {string} userId
 */
async function createCheckoutSession(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const priced = await priceCart(client, userId);
    const {
      items: linePayloads,
      totalAmount,
      cityId,
      deliveryAddress,
      deliveryPincode,
    } = priced;

    if (!linePayloads.length || totalAmount <= 0) {
      await client.query('ROLLBACK');
      const err = new Error('Cart is empty');
      err.status = 400;
      err.code = 'EMPTY_CART';
      throw err;
    }

    const itemsJson = linePayloads.map((line) => ({
      ...line,
      pricing_slab_snapshot:
        typeof line.pricing_slab_snapshot === 'string'
          ? line.pricing_slab_snapshot
          : JSON.stringify(line.pricing_slab_snapshot ?? {}),
    }));

    const { rows: insertRows } = await client.query(
      `INSERT INTO payment_sessions (
        user_id, status, amount_total, currency, items,
        delivery_address, delivery_pincode, delivery_city_id,
        saved_list_id, uploaded_order_id
      ) VALUES ($1, 'created', $2, 'INR', $3::jsonb, $4, $5, $6, NULL, NULL)
      RETURNING id`,
      [
        userId,
        totalAmount,
        JSON.stringify(itemsJson),
        deliveryAddress,
        deliveryPincode,
        cityId,
      ]
    );
    const sessionId = insertRows[0].id;
    const merchantOrderId = `1sm_${sessionId}`;

    const { rows: userRows } = await client.query(
      `SELECT id, name, phone, business_name FROM users WHERE id = $1`,
      [userId]
    );
    const u = userRows[0];
    let phone = u?.phone ? String(u.phone).replace(/\s/g, '') : null;
    if (!phone) {
      console.warn('[Payments] customer_phone missing for user', userId, '— using placeholder');
      phone = '9999999999';
    }
    const customerName =
      (u?.business_name && String(u.business_name).trim()) ||
      (u?.name && String(u.name).trim()) ||
      'Customer';
    const customerEmail = `${userId}@buyer.1stopmandi.local`;

    const baseUrl = process.env.API_BASE_URL;
    if (!baseUrl || String(baseUrl).trim() === '') {
      console.warn('[Payments] API_BASE_URL is missing — Cashfree notify_url may be invalid');
    }
    const notifyUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, '')}/api/payments/webhook`
      : '';

    const cf = getCashfree();
    const createOrderRequest = {
      order_id: merchantOrderId,
      order_amount: Number(totalAmount),
      order_currency: 'INR',
      customer_details: {
        customer_id: String(userId),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: phone,
      },
      order_meta: {
        ...(notifyUrl ? { notify_url: notifyUrl } : {}),
      },
    };

    let cfResponse;
    try {
      cfResponse = await cf.PGCreateOrder(
        createOrderRequest,
        undefined,
        undefined,
        undefined
      );
    } catch (apiErr) {
      console.error('[Payments] PGCreateOrder failed', apiErr?.response?.data || apiErr.message);
      throw apiErr;
    }

    const data = cfResponse?.data || cfResponse;
    const paymentSessionId = data?.payment_session_id;
    const returnedOrderId = data?.order_id;

    if (!paymentSessionId) {
      await client.query('ROLLBACK');
      const err = new Error('Cashfree did not return payment_session_id');
      err.status = 502;
      throw err;
    }
    if (returnedOrderId && returnedOrderId !== merchantOrderId) {
      console.warn(
        '[Payments] Cashfree order_id mismatch — sent',
        merchantOrderId,
        'got',
        returnedOrderId
      );
    }

    await client.query(
      `UPDATE payment_sessions SET provider_order_id = $1, updated_at = now() WHERE id = $2`,
      [merchantOrderId, sessionId]
    );

    await client.query('COMMIT');

    return {
      orderId: merchantOrderId,
      paymentSessionId,
      environment:
        process.env.CASHFREE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX',
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[Payments] rollback failed', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verify Cashfree order is PAID and matches payment_session.
 */
async function verifyPaidOrder(providerOrderId, userId) {
  const cf = getCashfree();
  let response;
  try {
    response = await cf.PGFetchOrder(
      providerOrderId,
      undefined,
      undefined,
      undefined
    );
  } catch (e) {
    console.error('[Payments] PGFetchOrder failed', e?.response?.data || e.message);
    throw e;
  }

  const data = response?.data || response;
  console.log('[Payments] PGFetchOrder response shape', JSON.stringify(data).slice(0, 500));

  const orderStatus = data?.order_status;
  if (orderStatus !== 'PAID') {
    const err = new Error(`Payment not confirmed (status=${orderStatus})`);
    err.status = 402;
    err.code = 'PAYMENT_NOT_CONFIRMED';
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT * FROM payment_sessions WHERE provider_order_id = $1`,
    [providerOrderId]
  );
  if (rows.length === 0) {
    const err = new Error('Payment session not found');
    err.status = 404;
    err.code = 'SESSION_NOT_FOUND';
    throw err;
  }
  const session = rows[0];

  if (String(session.user_id) !== String(userId)) {
    const err = new Error('Session does not belong to this user');
    err.status = 403;
    err.code = 'SESSION_USER_MISMATCH';
    throw err;
  }

  const sessionAmt = parseFloat(session.amount_total);
  const cfAmt = parseFloat(data.order_amount);
  if (Number.isFinite(sessionAmt) && Number.isFinite(cfAmt) && sessionAmt !== cfAmt) {
    console.warn(
      `[Payments] amount mismatch session=${session.amount_total} cf=${data.order_amount}`
    );
  }

  if (
    (session.status === 'expired' || session.status === 'cancelled') &&
    orderStatus === 'PAID'
  ) {
    console.warn(`[Payments] reviving stale session order=${providerOrderId}`);
  }

  return { cfOrder: data, session };
}

/**
 * Idempotent order creation from payment_sessions snapshot.
 * @param {object} session — payment_sessions row
 * @param {object} _cfOrder — Cashfree order entity (reserved for logging / future use)
 * @param {{ client: import('pg').PoolClient }} options
 */
async function finalizeFromSession(session, _cfOrder, { client }) {
  const providerOrderId = session.provider_order_id;

  await client.query(`SELECT pg_advisory_xact_lock(88421, hashtext($1::text))`, [
    providerOrderId,
  ]);

  const { rows: existing } = await client.query(
    `SELECT * FROM orders WHERE provider_order_id = $1 FOR UPDATE`,
    [providerOrderId]
  );
  if (existing.length > 0) {
    return { order: existing[0], alreadyExisted: true };
  }

  let items = session.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items)) {
    const err = new Error('Invalid session items');
    err.status = 500;
    throw err;
  }

  const priceChangedAtCheckout = items.some((i) => i.price_changed === true);

  const orderNumber = await generateOrderNumber(client);
  const userId = session.user_id;
  const totalAmount = parseFloat(session.amount_total);

  let order;
  try {
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (
      user_id, order_number, status, source, saved_list_id, uploaded_order_id,
      total_amount, price_changed_at_checkout,
      delivery_address, delivery_pincode, delivery_city_id,
      payment_provider, provider_order_id, payment_status, paid_at
    )
    VALUES (
      $1, $2, 'confirmed', 'normal', $3, $4,
      $5, $6,
      $7, $8, $9,
      'cashfree', $10, 'paid', now()
    )
    RETURNING *`,
      [
        userId,
        orderNumber,
        session.saved_list_id,
        session.uploaded_order_id,
        totalAmount,
        priceChangedAtCheckout,
        session.delivery_address,
        session.delivery_pincode,
        session.delivery_city_id,
        providerOrderId,
      ]
    );
    order = orderRows[0];
  } catch (e) {
    if (e.code === '23505') {
      const { rows: dup } = await client.query(
        `SELECT * FROM orders WHERE provider_order_id = $1`,
        [providerOrderId]
      );
      if (dup.length > 0) {
        return { order: dup[0], alreadyExisted: true };
      }
    }
    throw e;
  }

  for (const line of items) {
    let snapshot = line.pricing_slab_snapshot;
    if (typeof snapshot === 'object') {
      snapshot = JSON.stringify(snapshot);
    }
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
        snapshot || '{}',
      ]
    );
  }

  await client.query(
    `UPDATE payment_sessions
     SET status = 'consumed', app_order_id = $1, updated_at = now()
     WHERE id = $2`,
    [order.id, session.id]
  );

  const { rows: cartRows } = await client.query(
    'SELECT id FROM carts WHERE user_id = $1',
    [userId]
  );
  if (cartRows.length > 0) {
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartRows[0].id]);
  }

  await inventoryService.releaseUserReservations(userId, { client });

  return { order, alreadyExisted: false };
}

async function sweepExpiredSessions() {
  const result = await pool.query(
    `UPDATE payment_sessions SET status = 'expired', updated_at = now()
     WHERE status = 'created' AND expires_at < now()`
  );
  console.log(`[Payments] swept expired sessions count=${result.rowCount}`);
}

/**
 * Webhook path: verify PAID via Cashfree, then idempotent finalize (same as app callback).
 * @param {string} providerOrderId — Cashfree / merchant order_id (e.g. 1sm_<uuid>)
 */
async function finalizeFromCashfreeWebhook(providerOrderId) {
  if (!providerOrderId) {
    console.warn('[PaymentsWebhook] missing provider_order_id');
    return { skipped: true, reason: 'no_order_id' };
  }

  const cf = getCashfree();
  let response;
  try {
    response = await cf.PGFetchOrder(
      providerOrderId,
      undefined,
      undefined,
      undefined
    );
  } catch (e) {
    console.error(
      '[PaymentsWebhook] PGFetchOrder failed',
      providerOrderId,
      e?.response?.data || e.message
    );
    throw e;
  }

  const data = response?.data || response;
  if (data?.order_status !== 'PAID') {
    console.log(
      '[PaymentsWebhook] skip finalize; status=',
      data?.order_status,
      'order=',
      providerOrderId
    );
    return { skipped: true, reason: 'not_paid' };
  }

  const { rows } = await pool.query(
    `SELECT * FROM payment_sessions WHERE provider_order_id = $1`,
    [providerOrderId]
  );
  if (rows.length === 0) {
    console.warn('[PaymentsWebhook] no payment_session for', providerOrderId);
    return { skipped: true, reason: 'no_session' };
  }
  const session = rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await finalizeFromSession(session, data, { client });
    await client.query('COMMIT');
    console.log(
      '[PaymentsWebhook] finalized',
      providerOrderId,
      result.alreadyExisted ? '(already existed)' : ''
    );
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Mark open payment_session as cancelled when Cashfree reports failure-type events.
 */
async function markPaymentSessionCancelled(providerOrderId) {
  const r = await pool.query(
    `UPDATE payment_sessions SET status = 'cancelled', updated_at = now()
     WHERE provider_order_id = $1 AND status = 'created'`,
    [providerOrderId]
  );
  console.log(
    `[PaymentsWebhook] cancelled sessions count=${r.rowCount} for ${providerOrderId}`
  );
}

/**
 * PGFetchOrder for app-side polling when the native Flutter SDK callback is slow or missing
 * (e.g. Web Checkout returning without delivering the method-channel result on some devices).
 * Must match a payment_sessions row for this user.
 */
async function getCashfreeOrderStatusForUser(providerOrderId, userId) {
  const { rows } = await pool.query(
    `SELECT id FROM payment_sessions
     WHERE provider_order_id = $1 AND user_id = $2
     LIMIT 1`,
    [providerOrderId, userId]
  );
  if (!rows.length) {
    const err = new Error('Payment session not found');
    err.status = 404;
    err.code = 'SESSION_NOT_FOUND';
    throw err;
  }

  const cf = getCashfree();
  let response;
  try {
    response = await cf.PGFetchOrder(
      providerOrderId,
      undefined,
      undefined,
      undefined
    );
  } catch (e) {
    console.error(
      '[Payments] PGFetchOrder (poll) failed',
      e?.response?.data || e.message
    );
    throw e;
  }

  const data = response?.data || response;
  const orderStatus = data?.order_status ?? null;
  return {
    orderStatus,
    orderId: data?.order_id ?? providerOrderId,
  };
}

module.exports = {
  getCashfree,
  priceCart,
  createCheckoutSession,
  verifyPaidOrder,
  getCashfreeOrderStatusForUser,
  finalizeFromSession,
  finalizeFromCashfreeWebhook,
  markPaymentSessionCancelled,
  sweepExpiredSessions,
};
