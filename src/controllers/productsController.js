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

async function getBySlug(req, res) {
  const { slug } = req.params;
  const cityId = req.query.city_id;
  const qty = req.query.qty;
  const data = await productsService.getBySlug(slug, cityId, qty);
  if (!data) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

async function getSuggestions(req, res) {
  const q = req.query.q || '';
  const cityId = req.query.city_id;
  const limit = parseInt(req.query.limit, 10) || 5;

  const data = await productsService.getSuggestions(q, cityId, limit);
  res.json({ success: true, data });
}

async function search(req, res) {
  const q = req.query.q || '';
  const categoryId = req.query.category_id;
  const minPrice = req.query.min_price ? parseFloat(req.query.min_price) : undefined;
  const maxPrice = req.query.max_price ? parseFloat(req.query.max_price) : undefined;
  const isVeg = req.query.is_veg;
  const cityId = req.query.city_id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const qty = req.query.qty;

  const result = await productsService.search({
    q,
    categoryId,
    minPrice,
    maxPrice,
    isVeg,
    cityId,
    page,
    limit,
    qty,
  });

  res.json({ success: true, ...result });
}

async function getFilters(req, res) {
  const cityId = req.query.city_id;
  const categoryId = req.query.category_id;
  const isVeg = req.query.is_veg;

  const data = await productsService.getFilters(cityId, categoryId, isVeg);
  res.json({ success: true, data });
}

async function getSimilar(req, res) {
  const { id } = req.params;
  const cityId = req.query.city_id;
  const limit = parseInt(req.query.limit, 10) || 5;

  // Get product to find category
  const product = await productsService.getById(id, cityId, 1);
  if (!product || !product.category || !product.category.id) {
    const err = new Error('Product not found or has no category');
    err.status = 404;
    throw err;
  }

  if (!cityId) {
    const err = new Error('cityId is required for similar products');
    err.status = 400;
    throw err;
  }

  const data = await productsService.getSimilarProducts(
    id,
    product.category.id,
    cityId,
    limit
  );

  res.json({ success: true, data });
}

module.exports = { list, getById, getBySlug, getSuggestions, search, getFilters, getSimilar };
