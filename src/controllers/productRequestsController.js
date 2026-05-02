const productRequestsService = require('../services/productRequestsService');

function getImageUrl(file) {
  if (!file || !file.filename) return null;
  return `/uploads/${file.filename}`;
}

async function create(req, res) {
  const imageUrl = getImageUrl(req.file) || req.body.image_url;
  const data = await productRequestsService.create(req.user.id, {
    ...req.body,
    image_url: imageUrl || null,
  });
  res.status(201).json({ success: true, data });
}

async function list(req, res) {
  const data = await productRequestsService.listByUser(req.user.id);
  res.json({ success: true, data });
}

module.exports = {
  create,
  list,
};
