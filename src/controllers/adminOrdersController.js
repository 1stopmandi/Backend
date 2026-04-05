const ordersService = require('../services/ordersService');
const adminOrdersService = require('../services/adminOrdersService');

async function patchStatus(req, res) {
  const { status } = req.body;
  if (!status) {
    const err = new Error('status is required');
    err.status = 400;
    throw err;
  }
  const order = await ordersService.updateStatusByAdmin(req.params.id, status);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: order });
}

async function listOrders(req, res) {
  const {
    status, source, user_id,
    page = 1, limit = 20,
    from, to,
  } = req.query;

  const result = await adminOrdersService.listOrders({
    status, source, userId: user_id,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    from, to,
  });
  res.json({ success: true, ...result });
}

async function getById(req, res) {
  const order = await adminOrdersService.getById(req.params.id);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: order });
}

async function getStats(req, res) {
  const { from, to } = req.query;
  const data = await adminOrdersService.getStats({ from, to });
  res.json({ success: true, data });
}

async function addTracking(req, res) {
  const { note, location } = req.body;
  if (!note) {
    const err = new Error('note is required');
    err.status = 400;
    throw err;
  }
  const data = await adminOrdersService.addTracking(
    req.params.id, { note, location: location || null }
  );
  if (!data) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

module.exports = { patchStatus, listOrders, getById, getStats, addTracking };