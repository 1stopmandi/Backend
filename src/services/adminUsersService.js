const { query } = require('../db');

async function listUsers({ search, page = 1, limit = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  let sql = 'SELECT id, phone, name, role, is_setup_completed, created_at FROM users';
  const params = [];
  let paramIndex = 1;

  if (search) {
    sql += ` WHERE phone LIKE $${paramIndex++} OR name ILIKE $${paramIndex++}`;
    params.push(`%${search}%`, `%${search}%`);
  }

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count FROM users ${search ? 'WHERE phone LIKE $1 OR name ILIKE $2' : ''}`,
    search ? [`%${search}%`, `%${search}%`] : []
  );
  const total = parseInt(countRows[0]?.count ?? 0, 10);

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  const { rows } = await query(sql, params);

  return {
    data: rows.map((r) => ({
      id: r.id,
      phone: r.phone,
      name: r.name,
      role: r.role,
      is_setup_completed: r.is_setup_completed,
      created_at: r.created_at,
    })),
    pagination: { page: Math.floor(offset / limit) + 1, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

async function setRole(userId, role) {
  const validRoles = ['buyer', 'admin'];
  if (!validRoles.includes(role)) {
    const err = new Error('Invalid role. Use: buyer, admin');
    err.status = 400;
    throw err;
  }
  const { rows } = await query(
    'UPDATE users SET role = $1, updated_at = now() WHERE id = $2 RETURNING id, phone, name, role',
    [role, userId]
  );
  return rows[0] || null;
}

async function promoteByPhone(phone) {
  const normalized = String(phone).replace(/\D/g, '');
  const { rows } = await query(
    'UPDATE users SET role = $1, updated_at = now() WHERE phone = $2 RETURNING id, phone, name, role',
    ['admin', normalized]
  );
  return rows[0] || null;
}

async function getById(userId) {
  const { rows } = await query(
    `SELECT id, phone, name, role, is_setup_completed, setup_step,
            business_name, owner_name, address, pincode, city_id,
            outlet_type, daily_order_volume, gst_number, fssai_number,
            gst_cert_url, fssai_cert_url, outlet_image_url,
            is_blocked, blocked_reason,
            created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function getUserOrders(userId, { page = 1, limit = 20 } = {}) {
  // confirm user exists
  const { rows: userCheck } = await query(
    'SELECT id FROM users WHERE id = $1', [userId]
  );
  if (userCheck.length === 0) return null;

  const offset = (Math.max(1, page) - 1) * limit;

  const { rows: countRows } = await query(
    'SELECT COUNT(*)::int AS count FROM orders WHERE user_id = $1',
    [userId]
  );
  const total = countRows[0]?.count ?? 0;

  const { rows } = await query(
    `SELECT id, order_number, status, source, total_amount,
            price_changed_at_checkout, created_at
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return {
    data: rows.map((r) => ({
      id:                       r.id,
      order_number:             r.order_number,
      status:                   r.status,
      source:                   r.source,
      total_amount:             parseFloat(r.total_amount),
      price_changed_at_checkout: r.price_changed_at_checkout,
      created_at:               r.created_at,
    })),
    pagination: {
      page, limit, total,
      total_pages: Math.ceil(total / limit) || 1,
    },
  };
}

async function blockUser(userId, blocked, reason) {
  const { rows } = await query(
    `UPDATE users
     SET is_blocked = $1, blocked_reason = $2, updated_at = now()
     WHERE id = $3
     RETURNING id, phone, name, role, is_blocked, blocked_reason`,
    [blocked, blocked ? (reason || null) : null, userId]
  );
  return rows[0] || null;
}

async function getStats() {
  const { rows } = await query(`
    SELECT
      COUNT(*)::int                                          AS total_users,
      COUNT(*) FILTER (WHERE is_setup_completed)::int       AS setup_completed,
      COUNT(*) FILTER (WHERE role = 'admin')::int           AS total_admins,
      COUNT(*) FILTER (WHERE is_blocked = true)::int        AS blocked_users,
      COUNT(*) FILTER (
        WHERE created_at >= now() - INTERVAL '7 days'
      )::int                                                AS new_this_week
    FROM users
  `);

  const { rows: orderStats } = await query(`
    SELECT
      COUNT(*)::int                                          AS total_orders,
      COUNT(*) FILTER (WHERE status = 'pending')::int       AS pending_orders,
      COUNT(*) FILTER (WHERE status = 'delivered')::int     AS delivered_orders,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int     AS cancelled_orders,
      COALESCE(SUM(total_amount), 0)::numeric               AS total_gmv
    FROM orders
  `);

  return {
    users:  rows[0],
    orders: orderStats[0],
  };
}

module.exports = { listUsers, setRole, promoteByPhone, getById, getUserOrders, blockUser, getStats };
