const uploadedOrdersService = require('../services/uploadedOrdersService');

function getImageUrl(file) {
  if (!file || !file.filename) return null;
  return `/uploads/${file.filename}`;
}

async function create(req, res) {
  const imageUrl = getImageUrl(req.file) || req.body.image_url;
  if (!imageUrl) {
    const err = new Error('Image is required. Upload a file or provide image_url.');
    err.status = 400;
    throw err;
  }
  const data = await uploadedOrdersService.create(req.user.id, imageUrl);
  res.status(201).json({ success: true, data });
}

async function list(req, res) {
  const data = await uploadedOrdersService.listByUser(req.user.id);
  res.json({ success: true, data });
}

async function getById(req, res) {
  const { id } = req.params;
  const data = await uploadedOrdersService.getById(id, req.user.id);
  if (!data) {
    const err = new Error('Upload not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

async function addToCart(req, res) {
  const { id } = req.params;
  const cart = await uploadedOrdersService.addToCart(id, req.user.id);
  res.json({ success: true, data: cart });
}

// --- Admin ---

async function listPending(req, res) {
  const status = req.query.status || 'processing';
  const data = await uploadedOrdersService.listByStatus(status);
  res.json({ success: true, data });
}

async function markReady(req, res) {
  const { id } = req.params;
  const { items, notes } = req.body;
  const data = await uploadedOrdersService.markReady(id, req.user.id, {
    items,
    notes,
  });
  res.json({ success: true, data });
}

async function markRejected(req, res) {
  const { id } = req.params;
  const { notes } = req.body;
  await uploadedOrdersService.markRejected(id, req.user.id, { notes });
  res.json({ success: true, message: 'Rejected' });
}

module.exports = {
  create,
  list,
  getById,
  addToCart,
  listPending,
  markReady,
  markRejected,
};
