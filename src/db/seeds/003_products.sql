DO $$
DECLARE
  v_vegetables  UUID;
  v_fruits      UUID;
  v_grains      UUID;
  v_oils        UUID;
  v_spices      UUID;

  v_tomato_id      UUID;
  v_onion_id       UUID;
  v_potato_id      UUID;
  v_apple_id       UUID;
  v_banana_id      UUID;
  v_rice_id        UUID;
  v_atta_id        UUID;
  v_oil_id         UUID;
  v_turmeric_id    UUID;
  v_chilli_id      UUID;

  v_pricing_id  UUID;
BEGIN

  SELECT id INTO v_vegetables FROM categories WHERE slug = 'vegetables' AND city_id IS NULL;
  SELECT id INTO v_fruits     FROM categories WHERE slug = 'fruits'     AND city_id IS NULL;
  SELECT id INTO v_grains     FROM categories WHERE slug = 'grains'     AND city_id IS NULL;
  SELECT id INTO v_oils       FROM categories WHERE slug = 'oils'       AND city_id IS NULL;
  SELECT id INTO v_spices     FROM categories WHERE slug = 'spices'     AND city_id IS NULL;

  -- ── Products ────────────────────────────────────────────────────────────

  INSERT INTO products (name, slug, category_id, unit, moq, stock, city_id, is_active)
  VALUES
    ('Tomato',             'tomato',             v_vegetables, 'kg',    1,   500,  NULL, true),
    ('Onion',              'onion',              v_vegetables, 'kg',    1,   300,  NULL, true),
    ('Potato',             'potato',             v_vegetables, 'kg',    5,   1000, NULL, true),
    ('Apple',              'apple',              v_fruits,     'kg',    1,   200,  NULL, true),
    ('Banana',             'banana',             v_fruits,     'dozen', 1,   150,  NULL, true),
    ('Basmati Rice',       'rice-basmati',       v_grains,     'kg',    5,   500,  NULL, true),
    ('Wheat Flour',        'wheat-flour',        v_grains,     'kg',    5,   300,  NULL, true),
    ('Mustard Oil',        'mustard-oil',        v_oils,       'litre', 1,   100,  NULL, true),
    ('Turmeric Powder',    'turmeric-powder',    v_spices,     'kg',    0.5, 50,   NULL, true),
    ('Red Chilli Powder',  'red-chilli-powder',  v_spices,     'kg',    0.5, 40,   NULL, true)
  ON CONFLICT DO NOTHING;

  -- grab IDs after insert
  SELECT id INTO v_tomato_id   FROM products WHERE slug = 'tomato'            AND city_id IS NULL;
  SELECT id INTO v_onion_id    FROM products WHERE slug = 'onion'             AND city_id IS NULL;
  SELECT id INTO v_potato_id   FROM products WHERE slug = 'potato'            AND city_id IS NULL;
  SELECT id INTO v_apple_id    FROM products WHERE slug = 'apple'             AND city_id IS NULL;
  SELECT id INTO v_banana_id   FROM products WHERE slug = 'banana'            AND city_id IS NULL;
  SELECT id INTO v_rice_id     FROM products WHERE slug = 'rice-basmati'      AND city_id IS NULL;
  SELECT id INTO v_atta_id     FROM products WHERE slug = 'wheat-flour'       AND city_id IS NULL;
  SELECT id INTO v_oil_id      FROM products WHERE slug = 'mustard-oil'       AND city_id IS NULL;
  SELECT id INTO v_turmeric_id FROM products WHERE slug = 'turmeric-powder'   AND city_id IS NULL;
  SELECT id INTO v_chilli_id   FROM products WHERE slug = 'red-chilli-powder' AND city_id IS NULL;

  -- ── Base pricing (global) ───────────────────────────────────────────────

  INSERT INTO product_pricing (product_id, city_id, base_price, is_active, valid_from, valid_to)
  VALUES
    (v_tomato_id,   NULL,  40.00, true, now(), NULL),
    (v_onion_id,    NULL,  30.00, true, now(), NULL),
    (v_potato_id,   NULL,  25.00, true, now(), NULL),
    (v_apple_id,    NULL, 120.00, true, now(), NULL),
    (v_banana_id,   NULL,  60.00, true, now(), NULL),
    (v_rice_id,     NULL,  80.00, true, now(), NULL),
    (v_atta_id,     NULL,  45.00, true, now(), NULL),
    (v_oil_id,      NULL, 180.00, true, now(), NULL),
    (v_turmeric_id, NULL, 200.00, true, now(), NULL),
    (v_chilli_id,   NULL, 250.00, true, now(), NULL)
  ON CONFLICT DO NOTHING;

  -- ── Slab pricing ────────────────────────────────────────────────────────
  -- Only for bulk products (vegetables, grains) — not fruits/spices

  -- Tomato slabs
  SELECT id INTO v_pricing_id FROM product_pricing
  WHERE product_id = v_tomato_id AND city_id IS NULL AND valid_to IS NULL;

  INSERT INTO pricing_slabs (pricing_id, min_qty, max_qty, price_per_unit, sort_order)
  VALUES
    (v_pricing_id, 1,   9.99,  40.00, 1),
    (v_pricing_id, 10,  49.99, 35.00, 2),
    (v_pricing_id, 50,  NULL,  30.00, 3)
  ON CONFLICT DO NOTHING;

  -- Onion slabs
  SELECT id INTO v_pricing_id FROM product_pricing
  WHERE product_id = v_onion_id AND city_id IS NULL AND valid_to IS NULL;

  INSERT INTO pricing_slabs (pricing_id, min_qty, max_qty, price_per_unit, sort_order)
  VALUES
    (v_pricing_id, 1,   9.99,  30.00, 1),
    (v_pricing_id, 10,  49.99, 26.00, 2),
    (v_pricing_id, 50,  NULL,  22.00, 3)
  ON CONFLICT DO NOTHING;

  -- Potato slabs
  SELECT id INTO v_pricing_id FROM product_pricing
  WHERE product_id = v_potato_id AND city_id IS NULL AND valid_to IS NULL;

  INSERT INTO pricing_slabs (pricing_id, min_qty, max_qty, price_per_unit, sort_order)
  VALUES
    (v_pricing_id, 5,   24.99, 25.00, 1),
    (v_pricing_id, 25,  99.99, 22.00, 2),
    (v_pricing_id, 100, NULL,  18.00, 3)
  ON CONFLICT DO NOTHING;

  -- Rice slabs
  SELECT id INTO v_pricing_id FROM product_pricing
  WHERE product_id = v_rice_id AND city_id IS NULL AND valid_to IS NULL;

  INSERT INTO pricing_slabs (pricing_id, min_qty, max_qty, price_per_unit, sort_order)
  VALUES
    (v_pricing_id, 5,  24.99, 80.00, 1),
    (v_pricing_id, 25, NULL,  70.00, 2)
  ON CONFLICT DO NOTHING;

  -- Wheat flour slabs
  SELECT id INTO v_pricing_id FROM product_pricing
  WHERE product_id = v_atta_id AND city_id IS NULL AND valid_to IS NULL;

  INSERT INTO pricing_slabs (pricing_id, min_qty, max_qty, price_per_unit, sort_order)
  VALUES
    (v_pricing_id, 5,  24.99, 45.00, 1),
    (v_pricing_id, 25, NULL,  38.00, 2)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed 003: products, pricing, slabs done';
END $$;