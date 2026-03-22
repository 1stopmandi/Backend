const adminUsersService = require('../services/adminUsersService');

async function listUsers(req, res) {
  const search = req.query.search;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const result = await adminUsersService.listUsers({ search, page, limit });
  res.json({ success: true, ...result });
}

async function setRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;
  if (!role) {
    const err = new Error('role is required');
    err.status = 400;
    throw err;
  }
  const user = await adminUsersService.setRole(id, role);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: user });
}

module.exports = { listUsers, setRole };
