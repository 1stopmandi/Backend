-- Slab pricing engine + cart/order columns.
-- Legacy: migrates products.price_per_unit → product_pricing.base_price when that column still exists.
-- Fresh install: 007 has no price_per_unit; this file only adds tables/alters.

CREATE TABLE customer_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_per_unit NUMERIC(10, 2) NOT NULL CHECK (price_per_unit > 0),
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_pricing_user_product ON customer_pricing (user_id, product_id);

CREATE TABLE product_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_product_pricing_valid_range
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX ux_product_pricing_one_active_global
  ON product_pricing (product_id)
  WHERE valid_to IS NULL AND city_id IS NULL;

CREATE UNIQUE INDEX ux_product_pricing_one_active_per_city
  ON product_pricing (product_id, city_id)
  WHERE valid_to IS NULL AND city_id IS NOT NULL;

CREATE INDEX idx_product_pricing_product_valid ON product_pricing (product_id, valid_to);

CREATE TABLE pricing_slabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_id UUID NOT NULL REFERENCES product_pricing(id) ON DELETE CASCADE,
  min_qty NUMERIC(12, 3) NOT NULL CHECK (min_qty >= 0),
  max_qty NUMERIC(12, 3),
  price_per_unit NUMERIC(10, 2) NOT NULL CHECK (price_per_unit > 0),
  sort_order INT NOT NULL,
  CONSTRAINT chk_pricing_slabs_max_ge_min
    CHECK (max_qty IS NULL OR max_qty >= min_qty)
);

CREATE INDEX idx_pricing_slabs_pricing_sort ON pricing_slabs (pricing_id, sort_order ASC);
CREATE UNIQUE INDEX ux_pricing_slabs_sort_per_pricing ON pricing_slabs (pricing_id, sort_order);

CREATE TABLE pricing_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  old_slabs JSONB,
  new_slabs JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_audit_log_product_changed ON pricing_audit_log (product_id, changed_at DESC);

ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS price_at_add NUMERIC(10, 2);
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'price_per_unit'
  ) THEN
    UPDATE cart_items ci
    SET price_at_add = p.price_per_unit
    FROM products p
    WHERE ci.product_id = p.id AND ci.price_at_add IS NULL;

    INSERT INTO product_pricing (product_id, city_id, is_active, base_price, valid_from, valid_to)
    SELECT p.id, NULL, true, p.price_per_unit, now(), NULL
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_pricing pp
      WHERE pp.product_id = p.id AND pp.valid_to IS NULL AND pp.city_id IS NULL
    );
  END IF;
END $$;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_applied NUMERIC(10, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS pricing_slab_snapshot JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'price_per_unit'
  ) THEN
    UPDATE order_items SET price_applied = price_per_unit WHERE price_applied IS NULL;
  END IF;
END $$;

ALTER TABLE order_items DROP COLUMN IF EXISTS price_per_unit;

ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE products DROP COLUMN IF EXISTS price_per_unit;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_changed_at_checkout BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE orders ALTER COLUMN status TYPE VARCHAR(30);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;
ALTER TABLE orders ADD CONSTRAINT chk_orders_status CHECK (
  status IN (
    'pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'
  )
);
