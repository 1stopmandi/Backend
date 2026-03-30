const categoriesService = require('../services/categoriesService');

async function list(req, res) {
  const { city_id: cityId, city_slug: citySlug } = req.query;
  const active = req.query.active !== 'false';
  const data = await categoriesService.list({ cityId, citySlug, active });
  res.json({ success: true, data });
}

async function getBySlug(req, res) {
  const { slug } = req.params;
  const data = await categoriesService.getBySlug(slug);
  if (!data) {
    const err = new Error('Category not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

async function getProducts(req, res) {
  const { slug } = req.params;
  const {
    city_id: cityId,       // required for correct pricing resolution
    page = 1,
    limit = 20,
    sort = 'name',         // name | price_asc | price_desc | newest
    in_stock,              // 'true' → only show stock > 0
  } = req.query;

  const result = await categoriesService.getProducts({
    slug,
    cityId: cityId || null,
    page:     Math.max(1, parseInt(page)),
    limit:    Math.min(100, parseInt(limit)),
    sort,
    inStockOnly: in_stock === 'true',
  });

  if (!result) {
    const err = new Error('Category not found');
    err.status = 404;
    throw err;
  }

  res.json({ success: true, ...result });
}

module.exports = { list, getBySlug, getProducts };