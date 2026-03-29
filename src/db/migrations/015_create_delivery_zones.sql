CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_delivery_zones_city FOREIGN KEY (city_id) REFERENCES cities(id),
  UNIQUE(city_id, slug)
);

CREATE INDEX idx_delivery_zones_city_id ON delivery_zones(city_id);
CREATE INDEX idx_delivery_zones_is_active ON delivery_zones(is_active);
