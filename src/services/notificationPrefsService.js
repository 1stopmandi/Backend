const { query } = require('../db');

function toResponse(row) {
  return {
    order_updates: row.order_updates === true,
    billing_alerts: row.billing_alerts === true,
    price_changes: row.price_changes === true,
    announcements: row.announcements === true,
    updated_at: row.updated_at,
  };
}

async function ensureRow(userId) {
  await query(
    `INSERT INTO notification_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

async function getByUser(userId) {
  await ensureRow(userId);
  const { rows } = await query(
    `SELECT user_id, order_updates, billing_alerts, price_changes, announcements, updated_at
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId]
  );
  return toResponse(rows[0]);
}

async function updateByUser(userId, payload = {}) {
  await ensureRow(userId);

  const allowed = ['order_updates', 'billing_alerts', 'price_changes', 'announcements'];
  const updates = [];
  const values = [];
  let i = 1;

  for (const key of allowed) {
    if (payload[key] !== undefined) {
      updates.push(`${key} = $${i++}`);
      values.push(Boolean(payload[key]));
    }
  }

  if (updates.length === 0) {
    return getByUser(userId);
  }

  values.push(userId);
  const { rows } = await query(
    `UPDATE notification_preferences
     SET ${updates.join(', ')}, updated_at = now()
     WHERE user_id = $${i}
     RETURNING user_id, order_updates, billing_alerts, price_changes, announcements, updated_at`,
    values
  );

  return toResponse(rows[0]);
}

module.exports = {
  getByUser,
  updateByUser,
};
