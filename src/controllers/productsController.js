const productsService = require('../services/productsService');

async function list(req, res) {
  const categoryId = req.query.category_id;
  const cityId = req.query.city_id;
  const search = req.query.search;
  const qty = req.query.qty;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const result = await productsService.list({
    categoryId,
    cityId,
    search,
    qty,
    page,
    limit,
  });
  res.json({ success: true, ...result });
}

async function getById(req, res) {
  const { id } = req.params;
  const cityId = req.query.city_id;
  const qty = req.query.qty;
  const data = await productsService.getById(id, cityId, qty);
  if (!data) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

module.exports = { list, getById };
