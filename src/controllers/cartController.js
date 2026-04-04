const cartService = require('../services/cartService');

async function getCart(req, res) {
  const cart = await cartService.getCart(req.user.id);
  res.json({ success: true, data: cart });
}

async function addItem(req, res) {
  const { product_id, quantity } = req.body;
  if (!product_id) {
    const err = new Error('product_id is required');
    err.status = 400;
    throw err;
  }
  const cart = await cartService.addItem(req.user.id, product_id, quantity ?? 1);
  res.json({ success: true, data: cart });
}

async function removeItem(req, res) {
  const { productId } = req.params;
  const cart = await cartService.removeItem(req.user.id, productId);
  res.json({ success: true, data: cart });
}

async function clearCart(req, res) {
  const cart = await cartService.clearCart(req.user.id);
  res.json({ success: true, data: cart });
}

async function updateItem(req, res) {
  const { productId } = req.params;
  const { quantity } = req.body;

  if (quantity === undefined || quantity === null) {
    const err = new Error('quantity is required');
    err.status = 400;
    throw err;
  }

  const cart = await cartService.updateItem(req.user.id, productId, quantity);
  res.json({ success: true, data: cart });
}

async function validateCart(req, res) {
  const result = await cartService.validateCart(req.user.id);
  // always 200 — the payload tells the frontend what's wrong
  res.json({ success: true, data: result });
}

module.exports = { getCart, addItem, removeItem, clearCart, updateItem, validateCart };
