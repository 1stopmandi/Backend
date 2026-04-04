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

async function updateItem(userId, productId, quantity) {
  const cartId = await getOrCreateCart(userId);
  const cityId = await getBuyerCityId(userId);

  // confirm item is actually in the cart
  const { rows: existing } = await query(
    'SELECT id FROM cart_items WHERE cart_id = $1 AND product_id = $2',
    [cartId, productId]
  );
  if (existing.length === 0) {
    const err = new Error('Item not in cart');
    err.status = 404;
    throw err;
  }

  const qty = parseFloat(quantity);

  // quantity 0 or negative = remove
  if (isNaN(qty) || qty <= 0) {
    return removeItem(userId, productId);
  }

  // same moq + stock checks as addItem
  const { rows: productRows } = await query(
    'SELECT moq, stock FROM products WHERE id = $1 AND is_active = true',
    [productId]
  );
  if (productRows.length === 0) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const moq   = parseFloat(productRows[0].moq);
  const stock = parseFloat(productRows[0].stock ?? 0);

  if (qty < moq) {
    const err = new Error(`Minimum order quantity is ${moq}`);
    err.status = 400;
    throw err;
  }
  if (qty > stock) {
    const err = new Error(`Only ${stock} units available`);
    err.status = 400;
    throw err;
  }

  // re-resolve price at the new quantity
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
    `UPDATE cart_items
     SET quantity = $1, price_at_add = $2, updated_at = now()
     WHERE cart_id = $3 AND product_id = $4`,
    [qty, priceAtAdd, cartId, productId]
  );

  return getCart(userId);
}

async function validateCart(userId) {
  const cartId = await getOrCreateCart(userId);
  const cityId = await getBuyerCityId(userId);

  const { rows: items } = await query(
    `SELECT ci.product_id, ci.quantity, ci.price_at_add,
            p.name, p.stock, p.moq, p.is_active
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.cart_id = $1`,
    [cartId]
  );

  if (items.length === 0) {
    return { valid: true, issues: [], items: [] };
  }

  const issues = [];
  const validatedItems = [];

  for (const item of items) {
    const qty      = parseFloat(item.quantity);
    const stock    = parseFloat(item.stock ?? 0);
    const moq      = parseFloat(item.moq);
    const itemIssues = [];

    // check 1 — product still active
    if (!item.is_active) {
      itemIssues.push({ type: 'unavailable', message: 'Product is no longer available' });
    }

    // check 2 — still in stock
    if (item.is_active && qty > stock) {
      itemIssues.push({
        type: 'insufficient_stock',
        message: `Only ${stock} units available, you have ${qty} in cart`,
        available: stock,
      });
    }

    // check 3 — price changed since added to cart
    let currentPrice = null;
    let priceChanged = false;
    try {
      currentPrice = await pricingService.getPrice(item.product_id, qty, userId, cityId);
      const priceAtAdd = item.price_at_add != null ? parseFloat(item.price_at_add) : null;
      if (priceAtAdd !== null && Math.abs(currentPrice - priceAtAdd) > 0.001) {
        priceChanged = true;
        itemIssues.push({
          type: 'price_changed',
          message: `Price changed from ₹${priceAtAdd} to ₹${currentPrice}`,
          old_price: priceAtAdd,
          new_price: currentPrice,
        });
      }
    } catch (e) {
      if (e instanceof PricingUnavailableError) {
        itemIssues.push({ type: 'unavailable', message: 'Pricing unavailable' });
      }
    }

    validatedItems.push({
      product_id:    item.product_id,
      name:          item.name,
      quantity:      qty,
      current_price: currentPrice,
      price_changed: priceChanged,
      issues:        itemIssues,
    });

    issues.push(...itemIssues);
  }

  return {
    valid:  issues.length === 0,
    issues,           // flat list — frontend can show a summary banner
    items:  validatedItems,  // per-item detail — frontend can highlight specific rows
  };
}

module.exports = {
  getCart,
  addItem,
  removeItem,
  clearCart,
  getOrCreateCart,
  updateItem,
  validateCart,
};
