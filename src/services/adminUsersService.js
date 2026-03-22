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

module.exports = { listUsers, setRole, promoteByPhone };
