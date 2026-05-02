DO $$
BEGIN
  -- Keep seed data declarative so adding/removing products is easy.
  WITH category_map AS (
    SELECT slug, id
    FROM categories
    WHERE city_id IS NULL
  ),
  seed_products AS (
    SELECT *
    FROM (VALUES
      -- Vegetables
      ('Tomato', 'tomato', 'vegetables', 'kg', 1.00::numeric, 500::numeric, 40.00::numeric),
      ('Onion', 'onion', 'vegetables', 'kg', 1.00::numeric, 300::numeric, 30.00::numeric),
      ('Potato', 'potato', 'vegetables', 'kg', 5.00::numeric, 1000::numeric, 25.00::numeric),
      ('Cauliflower', 'cauliflower', 'vegetables', 'kg', 1.00::numeric, 260::numeric, 42.00::numeric),
      ('Cabbage', 'cabbage', 'vegetables', 'kg', 1.00::numeric, 240::numeric, 28.00::numeric),
      ('Lady Finger', 'lady-finger', 'vegetables', 'kg', 1.00::numeric, 180::numeric, 48.00::numeric),
      ('Brinjal', 'brinjal', 'vegetables', 'kg', 1.00::numeric, 220::numeric, 36.00::numeric),
      ('Capsicum', 'capsicum', 'vegetables', 'kg', 1.00::numeric, 170::numeric, 62.00::numeric),

      -- Fruits
      ('Banana', 'banana', 'fruits', 'dozen', 1.00::numeric, 150::numeric, 60.00::numeric),
      ('Apple', 'apple', 'fruits', 'kg', 1.00::numeric, 200::numeric, 120.00::numeric),
      ('Orange', 'orange', 'fruits', 'kg', 1.00::numeric, 180::numeric, 90.00::numeric),
      ('Papaya', 'papaya', 'fruits', 'kg', 1.00::numeric, 140::numeric, 52.00::numeric),
      ('Pomegranate', 'pomegranate', 'fruits', 'kg', 1.00::numeric, 120::numeric, 145.00::numeric),
      ('Watermelon', 'watermelon', 'fruits', 'piece', 1.00::numeric, 95::numeric, 55.00::numeric),
      ('Black Grapes', 'black-grapes', 'fruits', 'kg', 1.00::numeric, 130::numeric, 110.00::numeric),

      -- Dairy
      ('Full Cream Milk', 'full-cream-milk', 'dairy', 'litre', 1.00::numeric, 320::numeric, 64.00::numeric),
      ('Paneer', 'paneer', 'dairy', 'kg', 1.00::numeric, 140::numeric, 360.00::numeric),
      ('Curd', 'curd', 'dairy', 'kg', 1.00::numeric, 180::numeric, 78.00::numeric),
      ('Butter', 'butter', 'dairy', 'kg', 0.50::numeric, 90::numeric, 520.00::numeric),
      ('Fresh Cream', 'fresh-cream', 'dairy', 'litre', 1.00::numeric, 70::numeric, 210.00::numeric),
      ('Processed Cheese', 'processed-cheese', 'dairy', 'kg', 0.50::numeric, 60::numeric, 430.00::numeric),

      -- Non-Veg
      ('Chicken Broiler', 'chicken-broiler', 'non-veg', 'kg', 1.00::numeric, 210::numeric, 190.00::numeric),
      ('Chicken Breast', 'chicken-breast', 'non-veg', 'kg', 1.00::numeric, 120::numeric, 290.00::numeric),
      ('Goat Curry Cut', 'goat-curry-cut', 'non-veg', 'kg', 1.00::numeric, 85::numeric, 740.00::numeric),
      ('Rohu Fish', 'rohu-fish', 'non-veg', 'kg', 1.00::numeric, 110::numeric, 250.00::numeric),
      ('Egg', 'egg', 'non-veg', 'tray', 1.00::numeric, 260::numeric, 165.00::numeric),

      -- Grains
      ('Basmati Rice', 'rice-basmati', 'grains', 'kg', 5.00::numeric, 500::numeric, 80.00::numeric),
      ('Wheat Flour', 'wheat-flour', 'grains', 'kg', 5.00::numeric, 300::numeric, 45.00::numeric),
      ('Maida', 'maida', 'grains', 'kg', 5.00::numeric, 280::numeric, 38.00::numeric),
      ('Semolina (Suji)', 'semolina-suji', 'grains', 'kg', 2.00::numeric, 240::numeric, 46.00::numeric),
      ('Poha', 'poha', 'grains', 'kg', 2.00::numeric, 170::numeric, 54.00::numeric),

      -- Spices
      ('Turmeric Powder', 'turmeric-powder', 'spices', 'kg', 0.50::numeric, 50::numeric, 200.00::numeric),
      ('Red Chilli Powder', 'red-chilli-powder', 'spices', 'kg', 0.50::numeric, 40::numeric, 250.00::numeric),
      ('Coriander Powder', 'coriander-powder', 'spices', 'kg', 0.50::numeric, 65::numeric, 165.00::numeric),
      ('Cumin Seeds', 'cumin-seeds', 'spices', 'kg', 0.50::numeric, 55::numeric, 360.00::numeric),
      ('Garam Masala', 'garam-masala', 'spices', 'kg', 0.25::numeric, 34::numeric, 420.00::numeric),
      ('Black Pepper', 'black-pepper', 'spices', 'kg', 0.25::numeric, 25::numeric, 690.00::numeric),

      -- Oils
      ('Mustard Oil', 'mustard-oil', 'oils', 'litre', 1.00::numeric, 100::numeric, 180.00::numeric),
      ('Refined Soyabean Oil', 'refined-soyabean-oil', 'oils', 'litre', 1.00::numeric, 150::numeric, 152.00::numeric),
      ('Sunflower Oil', 'sunflower-oil', 'oils', 'litre', 1.00::numeric, 130::numeric, 168.00::numeric),
      ('Desi Ghee', 'desi-ghee', 'oils', 'kg', 1.00::numeric, 45::numeric, 620.00::numeric),
      ('Coconut Oil', 'coconut-oil', 'oils', 'litre', 1.00::numeric, 70::numeric, 235.00::numeric),

      -- Pulses
      ('Toor Dal', 'toor-dal', 'pulses', 'kg', 2.00::numeric, 220::numeric, 126.00::numeric),
      ('Moong Dal', 'moong-dal', 'pulses', 'kg', 2.00::numeric, 210::numeric, 132.00::numeric),
      ('Masoor Dal', 'masoor-dal', 'pulses', 'kg', 2.00::numeric, 200::numeric, 118.00::numeric),
      ('Chana Dal', 'chana-dal', 'pulses', 'kg', 2.00::numeric, 230::numeric, 98.00::numeric),
      ('Urad Dal', 'urad-dal', 'pulses', 'kg', 2.00::numeric, 190::numeric, 142.00::numeric),
      ('Rajma', 'rajma', 'pulses', 'kg', 2.00::numeric, 170::numeric, 154.00::numeric)
    ) AS t(name, slug, category_slug, unit, moq, stock, base_price)
  )
  INSERT INTO products (name, slug, category_id, unit, moq, stock, city_id, is_active)
  SELECT
    sp.name,
    sp.slug,
    cm.id,
    sp.unit,
    sp.moq,
    sp.stock,
    NULL,
    true
  FROM seed_products sp
  JOIN category_map cm ON cm.slug = sp.category_slug
  ON CONFLICT DO NOTHING;

  -- Map local static files (served at /uploads — see Backend/src/index.js) to products.
  -- Filenames: Backend/uploads/products/{slug}.jpg — keep in sync when adding SKUs or assets.
  UPDATE products p
  SET image_url = '/uploads/products/' || p.slug || '.jpg'
  WHERE p.city_id IS NULL
    AND p.slug IN (
      'tomato', 'onion', 'potato', 'cauliflower', 'cabbage', 'lady-finger', 'brinjal', 'capsicum',
      'banana', 'apple', 'orange', 'papaya', 'pomegranate', 'watermelon', 'black-grapes',
      'full-cream-milk', 'paneer', 'curd', 'butter', 'fresh-cream', 'processed-cheese',
      'chicken-broiler', 'chicken-breast', 'goat-curry-cut', 'rohu-fish', 'egg',
      'rice-basmati', 'wheat-flour', 'maida', 'semolina-suji', 'poha',
      'turmeric-powder', 'red-chilli-powder', 'coriander-powder', 'cumin-seeds', 'garam-masala', 'black-pepper',
      'mustard-oil', 'refined-soyabean-oil', 'sunflower-oil', 'desi-ghee', 'coconut-oil',
      'toor-dal', 'moong-dal', 'masoor-dal', 'chana-dal', 'urad-dal', 'rajma'
    );

  WITH seed_products AS (
    SELECT *
    FROM (VALUES
      ('tomato', 40.00::numeric), ('onion', 30.00::numeric), ('potato', 25.00::numeric),
      ('cauliflower', 42.00::numeric), ('cabbage', 28.00::numeric), ('lady-finger', 48.00::numeric),
      ('brinjal', 36.00::numeric), ('capsicum', 62.00::numeric), ('banana', 60.00::numeric),
      ('apple', 120.00::numeric), ('orange', 90.00::numeric), ('papaya', 52.00::numeric),
      ('pomegranate', 145.00::numeric), ('watermelon', 55.00::numeric), ('black-grapes', 110.00::numeric),
      ('full-cream-milk', 64.00::numeric), ('paneer', 360.00::numeric), ('curd', 78.00::numeric),
      ('butter', 520.00::numeric), ('fresh-cream', 210.00::numeric), ('processed-cheese', 430.00::numeric),
      ('chicken-broiler', 190.00::numeric), ('chicken-breast', 290.00::numeric), ('goat-curry-cut', 740.00::numeric),
      ('rohu-fish', 250.00::numeric), ('egg', 165.00::numeric), ('rice-basmati', 80.00::numeric),
      ('wheat-flour', 45.00::numeric), ('maida', 38.00::numeric), ('semolina-suji', 46.00::numeric),
      ('poha', 54.00::numeric), ('turmeric-powder', 200.00::numeric), ('red-chilli-powder', 250.00::numeric),
      ('coriander-powder', 165.00::numeric), ('cumin-seeds', 360.00::numeric), ('garam-masala', 420.00::numeric),
      ('black-pepper', 690.00::numeric), ('mustard-oil', 180.00::numeric), ('refined-soyabean-oil', 152.00::numeric),
      ('sunflower-oil', 168.00::numeric), ('desi-ghee', 620.00::numeric), ('coconut-oil', 235.00::numeric),
      ('toor-dal', 126.00::numeric), ('moong-dal', 132.00::numeric), ('masoor-dal', 118.00::numeric),
      ('chana-dal', 98.00::numeric), ('urad-dal', 142.00::numeric), ('rajma', 154.00::numeric)
    ) AS t(slug, base_price)
  )
  INSERT INTO product_pricing (product_id, city_id, base_price, is_active, valid_from, valid_to)
  SELECT
    p.id,
    NULL,
    sp.base_price,
    true,
    now(),
    NULL
  FROM seed_products sp
  JOIN products p ON p.slug = sp.slug AND p.city_id IS NULL
  WHERE NOT EXISTS (
    SELECT 1
    FROM product_pricing pp
    WHERE pp.product_id = p.id
      AND pp.city_id IS NULL
      AND pp.valid_to IS NULL
  )
  ON CONFLICT DO NOTHING;

  WITH seed_slabs AS (
    SELECT *
    FROM (VALUES
      -- Vegetables
      ('tomato', 1.000::numeric, 9.990::numeric, 40.00::numeric, 1),
      ('tomato', 10.000::numeric, 49.990::numeric, 35.00::numeric, 2),
      ('tomato', 50.000::numeric, NULL::numeric, 30.00::numeric, 3),
      ('onion', 1.000::numeric, 9.990::numeric, 30.00::numeric, 1),
      ('onion', 10.000::numeric, 49.990::numeric, 26.00::numeric, 2),
      ('onion', 50.000::numeric, NULL::numeric, 22.00::numeric, 3),
      ('potato', 5.000::numeric, 24.990::numeric, 25.00::numeric, 1),
      ('potato', 25.000::numeric, 99.990::numeric, 22.00::numeric, 2),
      ('potato', 100.000::numeric, NULL::numeric, 18.00::numeric, 3),
      ('cauliflower', 1.000::numeric, 9.990::numeric, 42.00::numeric, 1),
      ('cauliflower', 10.000::numeric, 49.990::numeric, 38.00::numeric, 2),
      ('cauliflower', 50.000::numeric, NULL::numeric, 34.00::numeric, 3),
      ('cabbage', 1.000::numeric, 9.990::numeric, 28.00::numeric, 1),
      ('cabbage', 10.000::numeric, 49.990::numeric, 25.00::numeric, 2),
      ('cabbage', 50.000::numeric, NULL::numeric, 22.00::numeric, 3),
      ('lady-finger', 1.000::numeric, 9.990::numeric, 48.00::numeric, 1),
      ('lady-finger', 10.000::numeric, 49.990::numeric, 43.00::numeric, 2),
      ('lady-finger', 50.000::numeric, NULL::numeric, 39.00::numeric, 3),
      ('brinjal', 1.000::numeric, 9.990::numeric, 36.00::numeric, 1),
      ('brinjal', 10.000::numeric, 49.990::numeric, 32.00::numeric, 2),
      ('brinjal', 50.000::numeric, NULL::numeric, 28.00::numeric, 3),

      -- Grains
      ('rice-basmati', 5.000::numeric, 24.990::numeric, 80.00::numeric, 1),
      ('rice-basmati', 25.000::numeric, NULL::numeric, 70.00::numeric, 2),
      ('wheat-flour', 5.000::numeric, 24.990::numeric, 45.00::numeric, 1),
      ('wheat-flour', 25.000::numeric, NULL::numeric, 38.00::numeric, 2),
      ('maida', 5.000::numeric, 24.990::numeric, 38.00::numeric, 1),
      ('maida', 25.000::numeric, NULL::numeric, 34.00::numeric, 2),
      ('semolina-suji', 2.000::numeric, 9.990::numeric, 46.00::numeric, 1),
      ('semolina-suji', 10.000::numeric, NULL::numeric, 41.00::numeric, 2),
      ('poha', 2.000::numeric, 9.990::numeric, 54.00::numeric, 1),
      ('poha', 10.000::numeric, NULL::numeric, 48.00::numeric, 2),

      -- Pulses
      ('toor-dal', 2.000::numeric, 9.990::numeric, 126.00::numeric, 1),
      ('toor-dal', 10.000::numeric, NULL::numeric, 118.00::numeric, 2),
      ('moong-dal', 2.000::numeric, 9.990::numeric, 132.00::numeric, 1),
      ('moong-dal', 10.000::numeric, NULL::numeric, 124.00::numeric, 2),
      ('masoor-dal', 2.000::numeric, 9.990::numeric, 118.00::numeric, 1),
      ('masoor-dal', 10.000::numeric, NULL::numeric, 111.00::numeric, 2),
      ('chana-dal', 2.000::numeric, 9.990::numeric, 98.00::numeric, 1),
      ('chana-dal', 10.000::numeric, NULL::numeric, 92.00::numeric, 2),
      ('urad-dal', 2.000::numeric, 9.990::numeric, 142.00::numeric, 1),
      ('urad-dal', 10.000::numeric, NULL::numeric, 135.00::numeric, 2),
      ('rajma', 2.000::numeric, 9.990::numeric, 154.00::numeric, 1),
      ('rajma', 10.000::numeric, NULL::numeric, 146.00::numeric, 2),

      -- Non-Veg
      ('chicken-broiler', 1.000::numeric, 9.990::numeric, 190.00::numeric, 1),
      ('chicken-broiler', 10.000::numeric, NULL::numeric, 176.00::numeric, 2),
      ('chicken-breast', 1.000::numeric, 9.990::numeric, 290.00::numeric, 1),
      ('chicken-breast', 10.000::numeric, NULL::numeric, 274.00::numeric, 2),
      ('egg', 1.000::numeric, 9.990::numeric, 165.00::numeric, 1),
      ('egg', 10.000::numeric, NULL::numeric, 156.00::numeric, 2)
    ) AS t(slug, min_qty, max_qty, price_per_unit, sort_order)
  )
  INSERT INTO pricing_slabs (pricing_id, min_qty, max_qty, price_per_unit, sort_order)
  SELECT
    pp.id,
    ss.min_qty,
    ss.max_qty,
    ss.price_per_unit,
    ss.sort_order
  FROM seed_slabs ss
  JOIN products p
    ON p.slug = ss.slug
   AND p.city_id IS NULL
  JOIN product_pricing pp
    ON pp.product_id = p.id
   AND pp.city_id IS NULL
   AND pp.valid_to IS NULL
  ON CONFLICT (pricing_id, sort_order) DO NOTHING;

  RAISE NOTICE 'Seed 003: expanded products, pricing, slabs done';
END $$;