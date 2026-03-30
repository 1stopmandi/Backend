-- Seed delivery zones for Patna
INSERT INTO delivery_zones (city_id, name, slug, is_active, sort_order) 
SELECT id, 'North Patna', 'north-patna', true, 1 FROM cities WHERE slug = 'patna'
UNION ALL
SELECT id, 'South Patna', 'south-patna', true, 2 FROM cities WHERE slug = 'patna'
UNION ALL
SELECT id, 'East Patna', 'east-patna', true, 3 FROM cities WHERE slug = 'patna'
UNION ALL
SELECT id, 'West Patna', 'west-patna', true, 4 FROM cities WHERE slug = 'patna'
UNION ALL
SELECT id, 'Central Patna', 'central-patna', true, 5 FROM cities WHERE slug = 'patna'
ON CONFLICT DO NOTHING;

-- Seed pincode mappings for Patna zones (prefix-based matching)
-- North Patna (800001-800010 range)
INSERT INTO pincode_mappings (pincode_prefix, city_id, zone_id)
SELECT '8000', c.id, dz.id 
FROM cities c, delivery_zones dz 
WHERE c.slug = 'patna' AND dz.city_id = c.id AND dz.slug = 'north-patna'
ON CONFLICT (pincode_prefix, city_id) DO NOTHING;

-- South Patna (800020-800030 range)
INSERT INTO pincode_mappings (pincode_prefix, city_id, zone_id)
SELECT '8002', c.id, dz.id 
FROM cities c, delivery_zones dz 
WHERE c.slug = 'patna' AND dz.city_id = c.id AND dz.slug = 'south-patna'
ON CONFLICT (pincode_prefix, city_id) DO NOTHING;

-- East Patna (800013-800014 range)
INSERT INTO pincode_mappings (pincode_prefix, city_id, zone_id)
SELECT '8001', c.id, dz.id 
FROM cities c, delivery_zones dz 
WHERE c.slug = 'patna' AND dz.city_id = c.id AND dz.slug = 'east-patna'
ON CONFLICT (pincode_prefix, city_id) DO NOTHING;

-- West Patna (800003-800004 range)
INSERT INTO pincode_mappings (pincode_prefix, city_id, zone_id)
SELECT '80004', c.id, dz.id 
FROM cities c, delivery_zones dz 
WHERE c.slug = 'patna' AND dz.city_id = c.id AND dz.slug = 'west-patna'
ON CONFLICT (pincode_prefix, city_id) DO NOTHING;

-- Central Patna (800005-800009 range)
INSERT INTO pincode_mappings (pincode_prefix, city_id, zone_id)
SELECT '80000', c.id, dz.id 
FROM cities c, delivery_zones dz 
WHERE c.slug = 'patna' AND dz.city_id = c.id AND dz.slug = 'central-patna'
ON CONFLICT (pincode_prefix, city_id) DO NOTHING;
