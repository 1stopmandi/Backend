const notificationPrefsService = require('../services/notificationPrefsService');

async function getMyPreferences(req, res) {
  const data = await notificationPrefsService.getByUser(req.user.id);
  res.json({ success: true, data });
}

async function updateMyPreferences(req, res) {
  const data = await notificationPrefsService.updateByUser(req.user.id, req.body || {});
  res.json({ success: true, data });
}

module.exports = {
  getMyPreferences,
  updateMyPreferences,
};
