CREATE TABLE pincode_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pincode_prefix VARCHAR(6) NOT NULL,
  city_id UUID NOT NULL,
  zone_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_pincode_mappings_city FOREIGN KEY (city_id) REFERENCES cities(id),
  CONSTRAINT fk_pincode_mappings_zone FOREIGN KEY (zone_id) REFERENCES delivery_zones(id),
  UNIQUE(pincode_prefix, city_id)
);

CREATE INDEX idx_pincode_mappings_prefix ON pincode_mappings(pincode_prefix);
CREATE INDEX idx_pincode_mappings_city_id ON pincode_mappings(city_id);
CREATE INDEX idx_pincode_mappings_zone_id ON pincode_mappings(zone_id);
