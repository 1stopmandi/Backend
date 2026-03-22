const ordersService = require('../services/ordersService');

async function patchStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) {
    const err = new Error('status is required');
    err.status = 400;
    throw err;
  }
  const order = await ordersService.updateStatusByAdmin(id, status);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: order });
}

module.exports = { patchStatus };
