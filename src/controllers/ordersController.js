const ordersService = require('../services/ordersService');

async function getLast(req, res) {
  const order = await ordersService.getLastOrder(req.user.id);
  if (!order) {
    const err = new Error('No previous order found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: order });
}

async function addLastToCart(req, res) {
  const cart = await ordersService.addLastOrderToCart(req.user.id);
  res.json({ success: true, data: cart });
}

async function create(req, res) {
  const { saved_list_id, uploaded_order_id } = req.body;
  const order = await ordersService.createFromCart(req.user.id, {
    saved_list_id,
    uploaded_order_id,
  });
  res.status(201).json({ success: true, data: order });
}

async function list(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const result = await ordersService.list(req.user.id, { page, limit });
  res.json({ success: true, ...result });
}

async function getById(req, res) {
  const { id } = req.params;
  const order = await ordersService.getById(id, req.user.id);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: order });
}

// --- new handlers ---

async function cancel(req, res) {
  const order = await ordersService.cancelOrder(req.params.id, req.user.id);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: order });
}

async function reorder(req, res) {
  const cart = await ordersService.reorderById(req.params.id, req.user.id);
  res.json({ success: true, data: cart });
}

async function track(req, res) {
  const result = await ordersService.getTracking(req.params.id, req.user.id);
  if (!result) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: result });
}

async function invoice(req, res) {
  const { stream, filename } = await ordersService.generateInvoice(
    req.params.id,
    req.user.id
  );
  if (!stream) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  stream.pipe(res);
}

module.exports = {
  create, list, getById, getLast, addLastToCart, cancel, reorder, track, invoice,
};
