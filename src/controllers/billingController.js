const billingService = require('../services/billingService');

async function summary(req, res) {
  const data = await billingService.getSummary(req.user.id, {
    from: req.query.from,
    to: req.query.to,
  });
  res.json({ success: true, data });
}

async function orders(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const status = req.query.status || 'all';
  const result = await billingService.listOrders(req.user.id, { page, limit, status });
  res.json({ success: true, ...result });
}

module.exports = {
  summary,
  orders,
};
