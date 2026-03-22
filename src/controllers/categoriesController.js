const categoriesService = require('../services/categoriesService');

async function list(req, res) {
  const { city_id: cityId, city_slug: citySlug } = req.query;
  const active = req.query.active !== 'false';
  const data = await categoriesService.list({ cityId, citySlug, active });
  res.json({ success: true, data });
}

async function getById(req, res) {
  const { id } = req.params;
  const data = await categoriesService.getById(id);
  if (!data) {
    const err = new Error('Category not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

module.exports = { list, getById };
