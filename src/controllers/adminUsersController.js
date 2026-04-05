const adminUsersService = require('../services/adminUsersService');

async function listUsers(req, res) {
  const { search, page = 1, limit = 20 } = req.query;
  const result = await adminUsersService.listUsers({
    search,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });
  res.json({ success: true, ...result });
}

async function setRole(req, res) {
  const { role } = req.body;
  if (!role) {
    const err = new Error('role is required');
    err.status = 400;
    throw err;
  }
  const user = await adminUsersService.setRole(req.params.id, role);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: user });
}

// new handlers
async function getById(req, res) {
  const user = await adminUsersService.getById(req.params.id);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: user });
}

async function getUserOrders(req, res) {
  const { page = 1, limit = 20 } = req.query;
  const result = await adminUsersService.getUserOrders(req.params.id, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });
  if (!result) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, ...result });
}

async function blockUser(req, res) {
  const { blocked, reason } = req.body;
  if (typeof blocked !== 'boolean') {
    const err = new Error('blocked (boolean) is required');
    err.status = 400;
    throw err;
  }
  const user = await adminUsersService.blockUser(
    req.params.id, blocked, reason || null
  );
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: user });
}

async function getStats(req, res) {
  const data = await adminUsersService.getStats();
  res.json({ success: true, data });
}

async function promoteByPhone(req, res) {
  const { phone } = req.body;
  if (!phone) {
    const err = new Error('phone is required');
    err.status = 400;
    throw err;
  }
  const user = await adminUsersService.promoteByPhone(phone);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: user });
}

module.exports = {
  listUsers, setRole,
  getById, getUserOrders, blockUser, getStats, promoteByPhone,
};