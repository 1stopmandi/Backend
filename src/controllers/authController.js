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
  const { name } = req.body;
  const user = await authService.updateMe(req.user.id, { name });
  res.json({
    success: true,
    user,
  });
}

async function refreshAccessToken(req, res) {
  const token = await authService.refreshAccessToken(req.user);
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
  refreshAccessToken,
};
