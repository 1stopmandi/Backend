CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  sort_order INT DEFAULT 0,
  city_id UUID REFERENCES cities(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_categories_slug_global ON categories(slug) WHERE city_id IS NULL;
CREATE UNIQUE INDEX idx_categories_slug_city ON categories(slug, city_id) WHERE city_id IS NOT NULL;
