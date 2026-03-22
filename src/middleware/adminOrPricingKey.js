/**
 * After optionalAuth: allow X-Admin-Key matching ADMIN_PRICING_KEY, or admin JWT.
 */
function adminOrPricingKey(req, res, next) {
  const envKey = process.env.ADMIN_PRICING_KEY;
  const headerKey = req.headers['x-admin-key'];
  if (envKey && headerKey && headerKey === envKey) {
    return next();
  }
  if (req.user?.role === 'admin') {
    return next();
  }
  const err = new Error('Forbidden');
  err.status = 403;
  throw err;
}

module.exports = { adminOrPricingKey };
