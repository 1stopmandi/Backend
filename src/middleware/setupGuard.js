/**
 * Blocks access if user has not completed restaurant setup.
 * Use after authMiddleware on cart/order routes.
 */
function setupGuard(req, res, next) {
  if (!req.user.is_setup_completed) {
    const err = new Error('Complete your setup to start placing orders');
    err.status = 403;
    throw err;
  }
  next();
}

module.exports = { setupGuard };
