const { query } = require('../db');

const ALLOWED_STATUSES = new Set(['all', 'paid', 'unpaid', 'manual_settlement', 'refunded']);

function normalizeDate(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().slice(0, 10);
}

function parseNumber(value) {
  return parseFloat(value ?? 0);
}

async function getSummary(userId, { from, to } = {}) {
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(today.getDate() - 34);

  const fromDate = normalizeDate(from, defaultFrom.toISOString().slice(0, 10));
  const toDate = normalizeDate(to, today.toISOString().slice(0, 10));

  const { rows } = await query(
    `SELECT
       COALESCE(SUM(total_amount), 0) AS total_billed,
       COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'manual_settlement') THEN total_amount ELSE 0 END), 0) AS total_paid,
       COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END), 0) AS outstanding
     FROM orders
     WHERE user_id = $1
       AND created_at::date BETWEEN $2::date AND $3::date`,
    [userId, fromDate, toDate]
  );

  const { rows: weeklyRows } = await query(
    `SELECT
       date_trunc('week', created_at)::date AS week_start,
       COALESCE(SUM(total_amount), 0) AS billed,
       COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'manual_settlement') THEN total_amount ELSE 0 END), 0) AS paid,
       COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END), 0) AS outstanding
     FROM orders
     WHERE user_id = $1
       AND created_at::date BETWEEN $2::date AND $3::date
     GROUP BY date_trunc('week', created_at)
     ORDER BY week_start DESC`,
    [userId, fromDate, toDate]
  );

  return {
    from: fromDate,
    to: toDate,
    total_billed: parseNumber(rows[0]?.total_billed),
    total_paid: parseNumber(rows[0]?.total_paid),
    outstanding: parseNumber(rows[0]?.outstanding),
    weeks: weeklyRows.map((row) => ({
      week_start: row.week_start,
      billed: parseNumber(row.billed),
      paid: parseNumber(row.paid),
      outstanding: parseNumber(row.outstanding),
    })),
  };
}

async function listOrders(userId, { status = 'all', page = 1, limit = 20 } = {}) {
  const safeStatus = ALLOWED_STATUSES.has(status) ? status : 'all';
  const actualLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const actualPage = Math.max(Number(page) || 1, 1);
  const offset = (actualPage - 1) * actualLimit;

  const whereClause = safeStatus === 'all'
    ? 'WHERE user_id = $1'
    : 'WHERE user_id = $1 AND payment_status = $2';
  const params = safeStatus === 'all'
    ? [userId, actualLimit, offset]
    : [userId, safeStatus, actualLimit, offset];
  const countParams = safeStatus === 'all' ? [userId] : [userId, safeStatus];

  const countSql = safeStatus === 'all'
    ? 'SELECT COUNT(*)::int AS count FROM orders WHERE user_id = $1'
    : 'SELECT COUNT(*)::int AS count FROM orders WHERE user_id = $1 AND payment_status = $2';

  const { rows: countRows } = await query(countSql, countParams);

  const { rows } = await query(
    `SELECT id, order_number, status, total_amount, payment_status, paid_at, created_at
     FROM orders
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${safeStatus === 'all' ? 2 : 3}
     OFFSET $${safeStatus === 'all' ? 3 : 4}`,
    params
  );

  const total = parseInt(countRows[0]?.count ?? 0, 10);
  return {
    data: rows.map((row) => ({
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      total_amount: parseNumber(row.total_amount),
      payment_status: row.payment_status ?? 'unpaid',
      paid_at: row.paid_at,
      created_at: row.created_at,
    })),
    pagination: {
      page: actualPage,
      limit: actualLimit,
      total,
      totalPages: Math.ceil(total / actualLimit) || 1,
    },
  };
}

module.exports = {
  getSummary,
  listOrders,
};
