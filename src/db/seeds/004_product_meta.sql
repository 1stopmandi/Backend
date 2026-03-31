-- Backfill is_veg, brand, description, rating for seeded products

UPDATE products SET
  is_veg      = true,
  brand       = 'Farm Fresh',
  description = 'Fresh tomatoes sourced directly from local farms. Ideal for gravies, salads and curries.',
  rating      = 4.3,
  rating_count = 87
WHERE slug = 'tomato' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Farm Fresh',
  description = 'Premium quality onions with a sharp flavour. A kitchen staple for all cuisines.',
  rating      = 4.1,
  rating_count = 64
WHERE slug = 'onion' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Farm Fresh',
  description = 'Fresh potatoes suitable for frying, boiling and curries. Consistent size and quality.',
  rating      = 4.4,
  rating_count = 102
WHERE slug = 'potato' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Fresho',
  description = 'Premium Himalayan apples. Sweet, crunchy and freshly sourced.',
  rating      = 4.5,
  rating_count = 43
WHERE slug = 'apple' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Farm Fresh',
  description = 'Fresh bananas ripened naturally. Perfect for desserts and breakfast menus.',
  rating      = 4.2,
  rating_count = 38
WHERE slug = 'banana' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'India Gate',
  description = 'Long grain basmati rice with a rich aroma. Ideal for biryani and pulao.',
  rating      = 4.6,
  rating_count = 156
WHERE slug = 'rice-basmati' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Aashirvaad',
  description = 'Whole wheat flour stone-ground for soft rotis. High fibre, low maida.',
  rating      = 4.4,
  rating_count = 91
WHERE slug = 'wheat-flour' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Dhara',
  description = 'Cold-pressed mustard oil with a pungent aroma. Popular in North and East Indian cooking.',
  rating      = 4.3,
  rating_count = 55
WHERE slug = 'mustard-oil' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Catch',
  description = 'Pure ground turmeric powder with a bright golden colour and mild earthy flavour.',
  rating      = 4.5,
  rating_count = 72
WHERE slug = 'turmeric-powder' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Catch',
  description = 'Finely ground red chilli powder with a bold heat level. Ideal for marinades and gravies.',
  rating      = 4.2,
  rating_count = 68
WHERE slug = 'red-chilli-powder' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Amul',
  description = 'Fresh full cream milk with 6% fat. Ideal for tea, coffee, sweets and cooking.',
  rating      = 4.5,
  rating_count = 203
WHERE slug = 'full-cream-milk' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Amul',
  description = 'Fresh soft paneer made from pure cow milk. Consistent quality for daily restaurant use.',
  rating      = 4.6,
  rating_count = 178
WHERE slug = 'paneer' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Mother Dairy',
  description = 'Set curd with a thick creamy texture. Made from full cream pasteurised milk.',
  rating      = 4.3,
  rating_count = 94
WHERE slug = 'curd' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Amul',
  description = 'Pasteurised table butter made from fresh cream. Rich flavour for cooking and baking.',
  rating      = 4.7,
  rating_count = 134
WHERE slug = 'butter' AND city_id IS NULL;

UPDATE products SET
  is_veg      = true,
  brand       = 'Amul',
  description = 'Fresh liquid cream with 25% fat. Perfect for gravies, soups and desserts.',
  rating      = 4.4,
  rating_count = 61
WHERE slug = 'fresh-cream' AND city_id IS NULL;

-- refresh search vectors after backfill
UPDATE products SET search_vector = to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(brand, '') || ' ' ||
  coalesce(description, '')
);