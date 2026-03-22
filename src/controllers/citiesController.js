const citiesService = require('../services/citiesService');

async function list(req, res) {
  const active = req.query.active !== 'false';
  const data = await citiesService.list(active);
  res.json({ success: true, data });
}

async function getById(req, res) {
  const { id } = req.params;
  const data = await citiesService.getById(id);
  if (!data) {
    const err = new Error('City not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

module.exports = { list, getById };
