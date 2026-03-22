CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  category_id UUID REFERENCES categories(id),
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  moq DECIMAL(10, 2) NOT NULL DEFAULT 1,
  stock DECIMAL(12, 2) DEFAULT 0,
  image_url TEXT,
  city_id UUID REFERENCES cities(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_city ON products(city_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE UNIQUE INDEX idx_products_slug_city ON products(slug, city_id) WHERE city_id IS NOT NULL;
CREATE UNIQUE INDEX idx_products_slug_global ON products(slug) WHERE city_id IS NULL;
