const { query } = require('../db');
const pricingService = require('./pricingService');
const { PricingUnavailableError } = require('./pricingService');

async function getOrCreateCart(userId) {
  let { rows } = await query(
    'SELECT id FROM carts WHERE user_id = $1',
    [userId]
  );
  if (rows.length === 0) {
    const insert = await query(
      'INSERT INTO carts (user_id) VALUES ($1) RETURNING id',
      [userId]
    );
    return insert.rows[0].id;
  }
  return rows[0].id;
}

async function getBuyerCityId(userId) {
  const { rows } = await query('SELECT city_id FROM users WHERE id = $1', [userId]);
  return rows[0]?.city_id ?? null;
}

async function getCart(userId) {
  const cartId = await getOrCreateCart(userId);
  const cityId = await getBuyerCityId(userId);

  const { rows: items } = await query(
    `SELECT ci.id, ci.product_id, ci.quantity, ci.price_at_add,
            p.name AS product_name, p.unit, p.moq, p.stock, p.image_url
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.cart_id = $1`,
    [cartId]
  );

  const lines = items.map((row) => ({
    product_id: row.product_id,
    quantity: parseFloat(row.quantity),
    price_at_add: row.price_at_add != null ? parseFloat(row.price_at_add) : null,
  }));

  const resolved = await pricingService.resolvePricesForCart(lines, cityId, userId);
  const byProduct = Object.fromEntries(resolved.map((r) => [r.product_id, r]));

  const cartItems = items.map((row) => {
    const r = byProduct[row.product_id];
    return {
      id: row.id,
      product_id: row.product_id,
      product_name: row.product_name,
      unit: row.unit,
      unit_price: r.unit_price,
      quantity: r.quantity,
      line_total: r.line_total,
      price_changed: r.price_changed,
      price_at_add: row.price_at_add != null ? parseFloat(row.price_at_add) : null,
      moq: parseFloat(row.moq),
      stock: parseFloat(row.stock ?? 0),
      image_url: row.image_url,
    };
  });

  const total = cartItems.reduce((sum, i) => sum + i.line_total, 0);
  const any_price_changed = cartItems.some((i) => i.price_changed);

  return {
    id: cartId,
    items: cartItems,
    total: pricingService.roundMoney(total),
    item_count: cartItems.length,
    any_price_changed,
  };
}

async function addItem(userId, productId, quantity) {
  const cartId = await getOrCreateCart(userId);
  const cityId = await getBuyerCityId(userId);

  const { rows: productRows } = await query(
    'SELECT id, name, moq, stock, is_active FROM products WHERE id = $1 AND is_active = true',
    [productId]
  );
  if (productRows.length === 0) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  const product = productRows[0];
  const moq = parseFloat(product.moq);
  const stock = parseFloat(product.stock ?? 0);
  const qty = parseFloat(quantity);

  if (isNaN(qty) || qty < moq) {
    const err = new Error(`Minimum order is ${moq} (MOQ)`);
    err.status = 400;
    throw err;
  }
  if (qty > stock) {
    const err = new Error(`Only ${stock} available`);
    err.status = 400;
    throw err;
  }

  const hasPricing = await pricingService.hasActivePricing(productId, cityId);
  if (!hasPricing) {
    const err = new Error('Product currently unavailable');
    err.status = 400;
    throw err;
  }

  let priceAtAdd;
  try {
    priceAtAdd = await pricingService.getPrice(productId, qty, userId, cityId);
  } catch (e) {
    if (e instanceof PricingUnavailableError) {
      const err = new Error('Product currently unavailable');
      err.status = 400;
      throw err;
    }
    throw e;
  }

  await query(
    `INSERT INTO cart_items (cart_id, product_id, quantity, price_at_add, added_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), now())
     ON CONFLICT (cart_id, product_id) DO UPDATE SET
       quantity = $3,
       price_at_add = $4,
       updated_at = now()`,
    [cartId, productId, qty, priceAtAdd]
  );

  return getCart(userId);
}

async function removeItem(userId, productId) {
  const cartId = await getOrCreateCart(userId);

  await query(
    'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2',
    [cartId, productId]
  );

  return getCart(userId);
}

async function clearCart(userId) {
  const cartId = await getOrCreateCart(userId);
  await query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
  return {
    id: cartId,
    items: [],
    total: 0,
    item_count: 0,
    any_price_changed: false,
  };
}

module.exports = {
  getCart,
  addItem,
  removeItem,
  clearCart,
  getOrCreateCart,
};
