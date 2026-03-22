const { verify } = require('../utils/jwt');
const { query } = require('../db');

/**
 * Attaches req.user if Bearer token is valid; otherwise req.user = null.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const decoded = verify(token);
    const { rows } = await query(
      'SELECT id, phone, name, role, is_setup_completed, city_id FROM users WHERE id = $1',
      [decoded.userId]
    );
    req.user = rows[0] || null;
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { optionalAuth };
