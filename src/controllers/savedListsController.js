const savedListsService = require('../services/savedListsService');

async function list(req, res) {
  const data = await savedListsService.list(req.user.id);
  res.json({ success: true, data });
}

async function create(req, res) {
  const { name } = req.body;
  const data = await savedListsService.create(req.user.id, { name });
  res.status(201).json({ success: true, data });
}

async function getById(req, res) {
  const { id } = req.params;
  const data = await savedListsService.getById(id, req.user.id);
  if (!data) {
    const err = new Error('List not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

async function addItem(req, res) {
  const { id } = req.params;
  const { product_id, default_quantity } = req.body;
  const data = await savedListsService.addItem(id, req.user.id, {
    product_id,
    default_quantity,
  });
  if (!data) {
    const err = new Error('List not found');
    err.status = 404;
    throw err;
  }
  res.status(201).json({ success: true, data });
}

async function updateItem(req, res) {
  const { id, itemId } = req.params;
  const { default_quantity } = req.body;
  const data = await savedListsService.updateItem(id, itemId, req.user.id, {
    default_quantity,
  });
  if (!data) {
    const err = new Error('List or item not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

async function removeItem(req, res) {
  const { id, itemId } = req.params;
  const data = await savedListsService.removeItem(id, itemId, req.user.id);
  if (!data) {
    const err = new Error('List or item not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

async function orderAll(req, res) {
  const { id } = req.params;
  const merge = req.query.merge === 'true';
  const cart = await savedListsService.orderAll(id, req.user.id, { merge });
  res.json({ success: true, data: cart });
}

async function rename(req, res) {
  const { id } = req.params;
  const { name } = req.body;
  const data = await savedListsService.rename(id, req.user.id, { name });
  if (!data) {
    const err = new Error('List not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

async function deleteList(req, res) {
  const deleted = await savedListsService.deleteList(req.params.id, req.user.id);
  if (!deleted) {
    const err = new Error('List not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, message: 'List deleted' });
}

module.exports = {
  list,
  create,
  getById,
  addItem,
  updateItem,
  removeItem,
  orderAll,
  rename,
  deleteList
};
