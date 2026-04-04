const { query } = require('../db');
const cartService = require('./cartService');
const pricingService = require('./pricingService');

async function list(userId) {
  const { rows } = await query(
    `SELECT sl.id, sl.name, sl.created_at, sl.updated_at,
            (SELECT COUNT(*)::int FROM saved_list_items WHERE saved_list_id = sl.id) AS item_count
     FROM saved_lists sl
     WHERE sl.user_id = $1
     ORDER BY sl.updated_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    item_count: parseInt(r.item_count ?? 0, 10),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

async function create(userId, { name }) {
  if (!name || !name.trim()) {
    const err = new Error('name is required');
    err.status = 400;
    throw err;
  }
  const { rows } = await query(
    `INSERT INTO saved_lists (user_id, name) VALUES ($1, $2)
     RETURNING id, name, created_at, updated_at`,
    [userId, name.trim()]
  );
  return { ...rows[0], items: [] };
}

async function getById(listId, userId) {
  const { rows: listRows } = await query(
    'SELECT id, name, created_at, updated_at FROM saved_lists WHERE id = $1 AND user_id = $2',
    [listId, userId]
  );
  if (listRows.length === 0) return null;

  const { rows: itemRows } = await query(
    `SELECT sli.id, sli.product_id, sli.default_quantity,
            p.name AS product_name, p.unit, p.moq, p.stock, p.image_url
     FROM saved_list_items sli
     JOIN products p ON sli.product_id = p.id
     WHERE sli.saved_list_id = $1 AND p.is_active = true`,
    [listId]
  );

  const { rows: urows } = await query('SELECT city_id FROM users WHERE id = $1', [userId]);
  const cityId = urows[0]?.city_id ?? null;

  const items = [];
  for (const r of itemRows) {
    const qty = parseFloat(r.default_quantity);
    const pricing = await pricingService.getProductPricingForApi(r.product_id, qty, cityId);
    const displayPrice = pricing.is_available ? pricing.display_price : null;
    items.push({
      id: r.id,
      product_id: r.product_id,
      product_name: r.product_name,
      unit: r.unit,
      default_quantity: qty,
      price_per_unit: displayPrice,
      pricing_available: pricing.is_available,
      moq: parseFloat(r.moq),
      stock: parseFloat(r.stock ?? 0),
      image_url: r.image_url,
    });
  }

  return {
    ...listRows[0],
    items,
  };
}

async function addItem(listId, userId, { product_id, default_quantity }) {
  if (!product_id) {
    const err = new Error('product_id is required');
    err.status = 400;
    throw err;
  }
  const { rows: listRows } = await query(
    'SELECT id FROM saved_lists WHERE id = $1 AND user_id = $2',
    [listId, userId]
  );
  if (listRows.length === 0) return null;

  const qty = Math.max(0, parseFloat(default_quantity) || 1);
  await query(
    `INSERT INTO saved_list_items (saved_list_id, product_id, default_quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (saved_list_id, product_id) DO UPDATE SET default_quantity = $3`,
    [listId, product_id, qty]
  );
  await query('UPDATE saved_lists SET updated_at = now() WHERE id = $1', [listId]);
  return getById(listId, userId);
}

async function updateItem(listId, itemId, userId, { default_quantity }) {
  const qty = parseFloat(default_quantity);
  if (isNaN(qty) || qty < 0) {
    const err = new Error('default_quantity must be a positive number');
    err.status = 400;
    throw err;
  }
  const res = await query(
    `UPDATE saved_list_items SET default_quantity = $1
     WHERE id = $2 AND saved_list_id IN (SELECT id FROM saved_lists WHERE user_id = $3)`,
    [qty, itemId, userId]
  );
  if (res.rowCount === 0) return null;
  await query('UPDATE saved_lists SET updated_at = now() WHERE id = $1', [listId]);
  return getById(listId, userId);
}

async function removeItem(listId, itemId, userId) {
  const res = await query(
    `DELETE FROM saved_list_items
     WHERE id = $1 AND saved_list_id IN (SELECT id FROM saved_lists WHERE user_id = $2)`,
    [itemId, userId]
  );
  if (res.rowCount === 0) return null;
  await query('UPDATE saved_lists SET updated_at = now() WHERE id = $1', [listId]);
  return getById(listId, userId);
}

async function orderAll(listId, userId, { merge = false } = {}) {
  const list = await getById(listId, userId);
  if (!list || !list.items || list.items.length === 0) {
    const err = new Error('List not found or empty');
    err.status = 404;
    throw err;
  }

  if (!merge) {
    await cartService.clearCart(userId);
  }

  for (const item of list.items) {
    try {
      await cartService.addItem(userId, item.product_id, item.default_quantity);
    } catch {
      // Skip discontinued/out-of-stock/unpriced
    }
  }

  return cartService.getCart(userId);
}

async function rename(listId, userId, { name }) {
  if (!name || !name.trim()) {
    const err = new Error('name is required');
    err.status = 400;
    throw err;
  }
  const { rows } = await query(
    `UPDATE saved_lists SET name = $1, updated_at = now()
     WHERE id = $2 AND user_id = $3
     RETURNING id, name, created_at, updated_at`,
    [name.trim(), listId, userId]
  );
  if (rows.length === 0) return null;
  return rows[0];
}

async function deleteList(listId, userId) {
  const { rowCount } = await query(
    'DELETE FROM saved_lists WHERE id = $1 AND user_id = $2',
    [listId, userId]
  );
  return rowCount > 0;   // cascade deletes all saved_list_items automatically
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
