ALTER TABLE products ADD COLUMN IF NOT EXISTS is_veg      BOOLEAN        NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand        VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating       NUMERIC(3, 2)  CHECK (rating >= 0 AND rating <= 5);
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_count INT            NOT NULL DEFAULT 0;

-- index for filter queries
CREATE INDEX IF NOT EXISTS idx_products_is_veg ON products(is_veg);
CREATE INDEX IF NOT EXISTS idx_products_brand  ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_rating ON products(rating DESC NULLS LAST);

-- full-text search index (postgres native, no elasticsearch needed at this scale)
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

UPDATE products SET search_vector = to_tsvector('english', 
  coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(description, '')
);

CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING GIN(search_vector);

-- auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' || 
    coalesce(NEW.brand, '') || ' ' || 
    coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_search_vector ON products;
CREATE TRIGGER trg_products_search_vector
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();