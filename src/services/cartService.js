const { query } = require('../db');

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

async function getCart(userId) {
  const cartId = await getOrCreateCart(userId);

  const { rows: items } = await query(
    `SELECT ci.id, ci.product_id, ci.quantity,
            p.name AS product_name, p.unit, p.price_per_unit, p.moq, p.stock,
            p.image_url
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.cart_id = $1`,
    [cartId]
  );

  const cartItems = items.map((row) => {
    const price = parseFloat(row.price_per_unit);
    const qty = parseFloat(row.quantity);
    return {
      id: row.id,
      product_id: row.product_id,
      product_name: row.product_name,
      unit: row.unit,
      price_per_unit: price,
      quantity: qty,
      line_total: Math.round(price * qty * 100) / 100,
      moq: parseFloat(row.moq),
      stock: parseFloat(row.stock ?? 0),
      image_url: row.image_url,
    };
  });

  const total = cartItems.reduce((sum, i) => sum + i.line_total, 0);

  return {
    id: cartId,
    items: cartItems,
    total: Math.round(total * 100) / 100,
    item_count: cartItems.length,
  };
}

async function addItem(userId, productId, quantity) {
  const cartId = await getOrCreateCart(userId);

  const { rows: productRows } = await query(
    'SELECT id, name, price_per_unit, moq, stock FROM products WHERE id = $1 AND is_active = true',
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
    const err = new Error(`Quantity must be at least ${moq} (MOQ)`);
    err.status = 400;
    throw err;
  }
  if (qty > stock) {
    const err = new Error(`Insufficient stock. Available: ${stock}`);
    err.status = 400;
    throw err;
  }

  await query(
    `INSERT INTO cart_items (cart_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = $3, created_at = now()`,
    [cartId, productId, qty]
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
  return { id: cartId, items: [], total: 0, item_count: 0 };
}

module.exports = {
  getCart,
  addItem,
  removeItem,
  clearCart,
  getOrCreateCart,
};
