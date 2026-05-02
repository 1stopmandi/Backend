const authService = require('../services/authService');

async function sendOtp(req, res) {
  const { phone } = req.body;
  const { expiresIn } = await authService.sendOtp(phone);
  res.json({
    success: true,
    message: 'OTP sent successfully',
    expiresIn,
  });
}

async function verifyOtp(req, res) {
  const { phone, otp } = req.body;
  const { token, user } = await authService.verifyOtp(phone, otp);
  res.json({
    success: true,
    token,
    user,
  });
}

async function getMe(req, res) {
  const user = await authService.getMe(req.user.id);
  res.json({
    success: true,
    user,
  });
}

async function logout(req, res) {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}

async function updateMe(req, res) {
  const lockedFields = ['business_name', 'gst_number', 'fssai_number', 'outlet_type'];
  for (const field of lockedFields) {
    if (req.body?.[field] !== undefined) {
      const err = new Error(`${field} cannot be changed from profile settings. Contact support.`);
      err.status = 400;
      throw err;
    }
  }

  const user = await authService.updateMe(req.user.id, {
    name: req.body?.name,
    owner_name: req.body?.owner_name,
    alternate_contact: req.body?.alternate_contact,
    address: req.body?.address,
    pincode: req.body?.pincode,
    daily_order_volume: req.body?.daily_order_volume,
  });
  res.json({
    success: true,
    user,
  });
}

async function updateProfileImage(req, res) {
  if (!req.file?.filename) {
    const err = new Error('outlet_image is required');
    err.status = 400;
    throw err;
  }
  const user = await authService.updateOutletImage(req.user.id, `/uploads/${req.file.filename}`);
  res.json({ success: true, user });
}

async function refreshAccessToken(req, res) {
  const token = await authService.refreshAccessToken({
    userId: req.user.id,
    phone: req.user.phone,
    role: req.user.role,
  });
  res.json({
    success: true,
    token,
  });
}

module.exports = {
  sendOtp,
  verifyOtp,
  getMe,
  logout,
  updateMe,
  updateProfileImage,
  refreshAccessToken,
};
