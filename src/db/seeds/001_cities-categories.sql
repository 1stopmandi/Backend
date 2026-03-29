INSERT INTO cities (name, slug, is_active)
VALUES ('Patna', 'patna', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, sort_order, city_id) VALUES
  ('Vegetables', 'vegetables', 1, NULL),
  ('Fruits',     'fruits',     2, NULL),
  ('Dairy',      'dairy',      3, NULL),
  ('Non-Veg',    'non-veg',    4, NULL),
  ('Grains',     'grains',     5, NULL),
  ('Spices',     'spices',     6, NULL),
  ('Oils',       'oils',       7, NULL),
  ('Pulses',     'pulses',     8, NULL)
ON CONFLICT DO NOTHING;