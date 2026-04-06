const { query } = require('../db');

const RESERVATION_DURATION_MINUTES = 15;

/**
 * Get available stock for a single product
 * available_stock = total_stock - reserved_quantity (excluding expired)
 */
async function getAvailableStock(productId) {
  const { rows } = await query(
    `SELECT available FROM available_stock_view WHERE product_id = $1`,
    [productId]
  );

  if (rows.length === 0) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  return parseFloat(rows[0].available ?? 0);
}

/**
 * Get available stock for multiple products
 * Returns map of { productId: { available, reserved, total } }
 */
async function getBulkAvailableStock(productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return {};
  }

  const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await query(
    `SELECT product_id, stock, reserved, available FROM available_stock_view WHERE product_id IN (${placeholders})`,
    productIds
  );

  const result = {};
  rows.forEach((row) => {
    result[row.product_id] = {
      available: parseFloat(row.available ?? 0),
      reserved: parseFloat(row.reserved ?? 0),
      total: parseFloat(row.stock ?? 0),
    };
  });

  return result;
}

/**
 * Reserve stock for a user
 * Returns reservation ID or throws error if insufficient stock
 */
async function reserveStock(productId, userId, quantity) {
  const quantityNum = parseFloat(quantity);

  if (quantityNum <= 0) {
    const err = new Error('Quantity must be greater than 0');
    err.status = 400;
    throw err;
  }

  // Check product exists and has enough stock
  const { rows: stockRows } = await query(
    `SELECT available FROM available_stock_view WHERE product_id = $1`,
    [productId]
  );

  if (stockRows.length === 0) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const available = parseFloat(stockRows[0].available ?? 0);

  if (available < quantityNum) {
    const err = new Error(`Insufficient stock. Available: ${available}, Requested: ${quantityNum}`);
    err.status = 409;
    throw err;
  }

  // Create reservation with 15-minute expiry
  const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MINUTES * 60 * 1000);

  const { rows } = await query(
    `INSERT INTO stock_reservations (product_id, user_id, quantity, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, product_id) 
     DO UPDATE SET quantity = $3, expires_at = $4
     RETURNING id, expires_at`,
    [productId, userId, quantityNum, expiresAt]
  );

  return {
    reservation_id: rows[0].id,
    expires_at: rows[0].expires_at,
  };
}

/**
 * Release a specific reservation
 */
async function releaseReservation(reservationId) {
  const { rows } = await query(
    `DELETE FROM stock_reservations WHERE id = $1 RETURNING id`,
    [reservationId]
  );

  if (rows.length === 0) {
    const err = new Error('Reservation not found');
    err.status = 404;
    throw err;
  }

  return rows[0].id;
}

/**
 * Release all reservations for a user (cleanup on order placement)
 */
async function releaseUserReservations(userId) {
  const { rows } = await query(
    `DELETE FROM stock_reservations WHERE user_id = $1 RETURNING id`,
    [userId]
  );

  return rows.map((r) => r.id);
}

/**
 * Get active reservation for user/product
 */
async function getReservation(productId, userId) {
  const { rows } = await query(
    `SELECT id, quantity, expires_at FROM stock_reservations 
     WHERE product_id = $1 AND user_id = $2 AND expires_at > now()`,
    [productId, userId]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Clean up expired reservations (called by cron job)
 * Returns count of deleted reservations
 */
async function deleteExpiredReservations() {
  const { rows } = await query(
    `DELETE FROM stock_reservations WHERE expires_at <= now() RETURNING id`
  );

  return rows.length;
}

module.exports = {
  getAvailableStock,
  getBulkAvailableStock,
  reserveStock,
  releaseReservation,
  releaseUserReservations,
  getReservation,
  deleteExpiredReservations,
};
