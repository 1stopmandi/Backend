const pricingService = require('../services/pricingService');

async function updatePricing(req, res) {
  const {
    product_id,
    slug,
    city_id,
    base_price,
    slabs,
  } = req.body;

  if (base_price == null || Number.isNaN(Number(base_price))) {
    const err = new Error('base_price is required');
    err.status = 400;
    throw err;
  }
  if (!product_id && !slug) {
    const err = new Error('product_id or slug is required');
    err.status = 400;
    throw err;
  }

  const result = await pricingService.upsertPricing({
    productId: product_id || null,
    productSlug: slug || null,
    cityId: city_id ?? null,
    basePrice: Number(base_price),
    slabs: slabs || [],
    updatedBy: req.user?.id || null,
  });

  res.json({
    success: true,
    data: {
      id: result.id,
      product_id: result.product_id,
      city_id: result.city_id,
      base_price: parseFloat(result.base_price),
      valid_from: result.valid_from,
      slabs: result.slabs,
    },
  });
}

module.exports = { updatePricing };
