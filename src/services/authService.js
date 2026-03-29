const { query } = require('../db');
const { sign } = require('../utils/jwt');
const otpService = require('./otpService');
const { sendOtpSms } = require('./smsService');

function toUserResponse(row) {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    role: row.role,
    is_setup_completed: row.is_setup_completed,
  };
}

async function sendOtp(phone) {
  if (!otpService.validatePhone(phone)) {
    const err = new Error('Invalid phone format');
    err.status = 400;
    throw err;
  }

  if (!otpService.checkRateLimit(phone)) {
    const err = new Error('Too many OTP requests. Try again later.');
    err.status = 429;
    throw err;
  }

  const { code, expiresAt } = await otpService.createOtp(phone);
  await sendOtpSms(phone, code);
  otpService.setRateLimit(phone);

  return { expiresIn: otpService.OTP_EXPIRY_SEC };
}

async function verifyOtp(phone, otp) {
  if (!phone || !otp || typeof otp !== 'string') {
    const err = new Error('Invalid or expired OTP');
    err.status = 400;
    throw err;
  }

  const valid = await otpService.validateOtp(phone, otp);
  if (!valid) {
    const err = new Error('Invalid or expired OTP');
    err.status = 400;
    throw err;
  }

  const phoneNorm = otpService.normalizePhone(phone);

  // Find or create user
  let { rows } = await query(
    'SELECT id, phone, name, role, is_setup_completed FROM users WHERE phone = $1',
    [phoneNorm]
  );

  let user;
  if (rows.length === 0) {
    const insert = await query(
      `INSERT INTO users (phone) VALUES ($1)
       RETURNING id, phone, name, role, is_setup_completed`,
      [phoneNorm]
    );
    user = insert.rows[0];
  } else {
    user = rows[0];
  }

  const token = sign({
    userId: user.id,
    phone: user.phone,
    role: user.role,
  });

  return {
    token,
    user: toUserResponse(user),
  };
}

async function getMe(userId) {
  const { rows } = await query(
    'SELECT id, phone, name, role, is_setup_completed FROM users WHERE id = $1',
    [userId]
  );
  if (rows.length === 0) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  return toUserResponse(rows[0]);
}

async function refreshAccessToken(user) {
  if (!user || !user.userId) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  // Fetch the latest user data to ensure we have current role info
  const { rows } = await query(
    'SELECT id, phone, name, role, is_setup_completed FROM users WHERE id = $1',
    [user.userId]
  );

  if (rows.length === 0) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  const userData = rows[0];
  return sign({
    userId: userData.id,
    phone: userData.phone,
    role: userData.role,
  });
}

async function updateMe(userId, { name }) {
  const updates = [];
  const values = [];
  let i = 1;

  if (name !== undefined) {
    updates.push(`name = $${i++}`);
    values.push(name);
  }

  if (updates.length === 0) {
    return getMe(userId);
  }

  values.push(userId);
  const { rows } = await query(
    `UPDATE users SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $${i}
     RETURNING id, phone, name, role, is_setup_completed`,
    values
  );

  if (rows.length === 0) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  return toUserResponse(rows[0]);
}

module.exports = {
  sendOtp,
  verifyOtp,
  getMe,
  updateMe,
  refreshAccessToken,
};
