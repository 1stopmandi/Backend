const inventoryService = require('../services/inventoryService');

async function getStock(req, res) {
  const { productId } = req.params;
  const { rows: productRows } = await require('../db').query(
    `SELECT id, stock FROM products WHERE id = $1`,
    [productId]
  );

  if (productRows.length === 0) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const available = await inventoryService.getAvailableStock(productId);
  const { rows: reservedRows } = await require('../db').query(
    `SELECT COALESCE(SUM(quantity), 0) as reserved FROM stock_reservations 
     WHERE product_id = $1 AND expires_at > now()`,
    [productId]
  );

  const reserved = parseFloat(reservedRows[0].reserved ?? 0);
  const total = parseFloat(productRows[0].stock ?? 0);

  res.json({
    success: true,
    data: {
      product_id: productId,
      available_stock: available,
      reserved,
      total_stock: total,
    },
  });
}

async function getBulkStock(req, res) {
  const { skuIds } = req.body;

  if (!Array.isArray(skuIds) || skuIds.length === 0) {
    const err = new Error('skuIds array is required and must not be empty');
    err.status = 400;
    throw err;
  }

  const stockMap = await inventoryService.getBulkAvailableStock(skuIds);

  res.json({
    success: true,
    data: stockMap,
  });
}

async function reserveStock(req, res) {
  const { productId } = req.params;
  const { quantity } = req.body;
  const userId = req.user.id;

  if (quantity === undefined || quantity === null) {
    const err = new Error('quantity is required');
    err.status = 400;
    throw err;
  }

  const reservation = await inventoryService.reserveStock(productId, userId, quantity);

  res.status(201).json({
    success: true,
    data: {
      reservation_id: reservation.reservation_id,
      product_id: productId,
      quantity: parseFloat(quantity),
      expires_at: reservation.expires_at,
    },
  });
}

async function releaseReservation(req, res) {
  const { productId, reservationId } = req.params;
  const userId = req.user.id;

  // Verify reservation belongs to user
  const { rows } = await require('../db').query(
    `SELECT id FROM stock_reservations WHERE id = $1 AND user_id = $2 AND product_id = $3`,
    [reservationId, userId, productId]
  );

  if (rows.length === 0) {
    const err = new Error('Reservation not found or does not belong to user');
    err.status = 404;
    throw err;
  }

  await inventoryService.releaseReservation(reservationId);

  res.json({
    success: true,
    data: {
      reservation_id: reservationId,
      message: 'Reservation released',
    },
  });
}

module.exports = {
  getStock,
  getBulkStock,
  reserveStock,
  releaseReservation,
};
