function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  next();
}

module.exports = { requireAdmin };
