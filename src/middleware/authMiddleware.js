const { verify } = require('../utils/jwt');
const { query } = require('../db');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verify(token);
    const { rows } = await query(
      'SELECT id, phone, name, role, is_setup_completed, city_id FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (rows.length === 0) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.status) throw err;
    const unauthorized = new Error('Unauthorized');
    unauthorized.status = 401;
    throw unauthorized;
  }
}

module.exports = { authMiddleware };
