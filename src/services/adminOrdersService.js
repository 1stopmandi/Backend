const { query } = require('../db');
const ordersService = require('./ordersService');

async function listOrders({
  status, source, userId,
  page = 1, limit = 20,
  from, to,
} = {}) {
  const offset     = (Math.max(1, page) - 1) * limit;
  const actualLimit = Math.min(limit, 100);
  const conditions = [];
  const params     = [];
  let   pi         = 1;

  if (status) {
    params.push(status);
    conditions.push(`o.status = $${pi++}`);
  }
  if (source) {
    params.push(source);
    conditions.push(`o.source = $${pi++}`);
  }
  if (userId) {
    params.push(userId);
    conditions.push(`o.user_id = $${pi++}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`o.created_at >= $${pi++}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`o.created_at <= $${pi++}`);
  }

  const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count FROM orders o ${WHERE}`,
    params
  );
  const total = countRows[0]?.count ?? 0;

  params.push(actualLimit, offset);
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.status, o.source,
            o.total_amount, o.price_changed_at_checkout,
            o.delivery_address, o.delivery_pincode,
            o.created_at, o.updated_at,
            u.name AS user_name, u.phone AS user_phone,
            u.business_name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     ${WHERE}
     ORDER BY o.created_at DESC
     LIMIT $${pi++} OFFSET $${pi}`,
    params
  );

  return {
    data: rows.map((r) => ({
      id:                       r.id,
      order_number:             r.order_number,
      status:                   r.status,
      source:                   r.source,
      total_amount:             parseFloat(r.total_amount),
      price_changed_at_checkout: r.price_changed_at_checkout,
      delivery_address:         r.delivery_address,
      delivery_pincode:         r.delivery_pincode,
      created_at:               r.created_at,
      user: {
        name:          r.user_name,
        phone:         r.user_phone,
        business_name: r.business_name,
      },
    })),
    pagination: {
      page, limit: actualLimit, total,
      total_pages: Math.ceil(total / actualLimit) || 1,
    },
  };
}

async function getById(orderId) {
  // admin version — no userId ownership check
  const { rows: orderRows } = await query(
    `SELECT o.id, o.order_number, o.status, o.source,
            o.saved_list_id, o.uploaded_order_id,
            o.total_amount, o.price_changed_at_checkout,
            o.delivery_address, o.delivery_pincode, o.delivery_city_id,
            o.created_at, o.updated_at,
            u.id AS user_id, u.name AS user_name,
            u.phone AS user_phone, u.business_name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     WHERE o.id = $1`,
    [orderId]
  );
  if (orderRows.length === 0) return null;

  const r = orderRows[0];

  const { rows: itemRows } = await query(
    `SELECT oi.id, oi.product_id, oi.product_name, oi.unit,
            oi.price_applied, oi.quantity, oi.line_total,
            oi.pricing_slab_snapshot,
            p.image_url, p.slug
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY oi.created_at`,
    [orderId]
  );

  const { rows: trackingRows } = await query(
    `SELECT status, note, location, created_at
     FROM order_delivery_tracking
     WHERE order_id = $1
     ORDER BY created_at ASC`,
    [orderId]
  );

  return {
    id:                       r.id,
    order_number:             r.order_number,
    status:                   r.status,
    source:                   r.source,
    total_amount:             parseFloat(r.total_amount),
    price_changed_at_checkout: r.price_changed_at_checkout,
    delivery_address:         r.delivery_address,
    delivery_pincode:         r.delivery_pincode,
    delivery_city_id:         r.delivery_city_id,
    created_at:               r.created_at,
    updated_at:               r.updated_at,
    user: {
      id:            r.user_id,
      name:          r.user_name,
      phone:         r.user_phone,
      business_name: r.business_name,
    },
    items: itemRows.map((row) => {
      let snapshot = row.pricing_slab_snapshot;
      if (typeof snapshot === 'string') {
        try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; }
      }
      return {
        id:                    row.id,
        product_id:            row.product_id,
        product_name:          row.product_name,
        product_slug:          row.slug       || null,
        image_url:             row.image_url  || null,
        unit:                  row.unit,
        price_applied:         parseFloat(row.price_applied),
        quantity:              parseFloat(row.quantity),
        line_total:            parseFloat(row.line_total),
        pricing_slab_snapshot: snapshot,
      };
    }),
    tracking: trackingRows,
  };
}

async function getStats({ from, to } = {}) {
  const dateCondition = from && to
    ? `WHERE created_at BETWEEN '${from}' AND '${to}'`
    : '';

  const { rows } = await query(`
    SELECT
      COUNT(*)::int                                              AS total_orders,
      COUNT(*) FILTER (WHERE status = 'pending')::int           AS pending,
      COUNT(*) FILTER (WHERE status = 'confirmed')::int         AS confirmed,
      COUNT(*) FILTER (WHERE status = 'out_for_delivery')::int  AS out_for_delivery,
      COUNT(*) FILTER (WHERE status = 'delivered')::int         AS delivered,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int         AS cancelled,
      COALESCE(SUM(total_amount), 0)::numeric                   AS total_gmv,
      COALESCE(
        SUM(total_amount) FILTER (WHERE status = 'delivered'), 0
      )::numeric                                                AS delivered_gmv,
      COALESCE(AVG(total_amount), 0)::numeric                   AS avg_order_value
    FROM orders
    ${dateCondition}
  `);

  const { rows: sourceRows } = await query(`
    SELECT source, COUNT(*)::int AS count
    FROM orders
    ${dateCondition}
    GROUP BY source
    ORDER BY count DESC
  `);

  return {
    ...rows[0],
    by_source: sourceRows,
  };
}

async function addTracking(orderId, { note, location }) {
  // confirm order exists
  const { rows: orderRows } = await query(
    'SELECT id, status FROM orders WHERE id = $1',
    [orderId]
  );
  if (orderRows.length === 0) return null;

  const { rows } = await query(
    `INSERT INTO order_delivery_tracking
       (order_id, status, note, location)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [orderId, orderRows[0].status, note, location]
  );

  return rows[0];
}

module.exports = { listOrders, getById, getStats, addTracking };