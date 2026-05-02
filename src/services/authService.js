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
    business_name: row.business_name ?? null,
    owner_name: row.owner_name ?? null,
    alternate_contact: row.alternate_contact ?? null,
    address: row.address ?? null,
    pincode: row.pincode ?? null,
    city_id: row.city_id ?? null,
    outlet_type: row.outlet_type ?? null,
    daily_order_volume: row.daily_order_volume ?? null,
    gst_number: row.gst_number ?? null,
    fssai_number: row.fssai_number ?? null,
    outlet_image_url: row.outlet_image_url ?? null,
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
    `SELECT id, phone, name, role, is_setup_completed, business_name, owner_name,
            alternate_contact, address, pincode, city_id, outlet_type,
            daily_order_volume, gst_number, fssai_number, outlet_image_url
     FROM users WHERE phone = $1`,
    [phoneNorm]
  );

  let user;
  if (rows.length === 0) {
    const insert = await query(
      `INSERT INTO users (phone) VALUES ($1)
       RETURNING id, phone, name, role, is_setup_completed, business_name, owner_name,
         alternate_contact, address, pincode, city_id, outlet_type,
         daily_order_volume, gst_number, fssai_number, outlet_image_url`,
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
    `SELECT id, phone, name, role, is_setup_completed, business_name, owner_name,
            alternate_contact, address, pincode, city_id, outlet_type,
            daily_order_volume, gst_number, fssai_number, outlet_image_url
     FROM users WHERE id = $1`,
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

async function updateMe(userId, {
  name,
  owner_name,
  alternate_contact,
  address,
  pincode,
  daily_order_volume,
}) {
  const updates = [];
  const values = [];
  let i = 1;

  if (name !== undefined) {
    updates.push(`name = $${i++}`);
    values.push(name ? String(name).trim() : null);
  }

  if (owner_name !== undefined) {
    updates.push(`owner_name = $${i++}`);
    values.push(owner_name ? String(owner_name).trim() : null);
  }

  if (alternate_contact !== undefined) {
    updates.push(`alternate_contact = $${i++}`);
    values.push(alternate_contact ? String(alternate_contact).trim() : null);
  }

  if (address !== undefined) {
    updates.push(`address = $${i++}`);
    values.push(address ? String(address).trim() : null);
  }

  if (pincode !== undefined) {
    updates.push(`pincode = $${i++}`);
    values.push(pincode ? String(pincode).trim() : null);
  }

  if (daily_order_volume !== undefined) {
    updates.push(`daily_order_volume = $${i++}`);
    values.push(daily_order_volume ? String(daily_order_volume).trim() : null);
  }

  if (updates.length === 0) {
    return getMe(userId);
  }

  values.push(userId);
  const { rows } = await query(
    `UPDATE users SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $${i}
     RETURNING id, phone, name, role, is_setup_completed, business_name, owner_name,
       alternate_contact, address, pincode, city_id, outlet_type,
       daily_order_volume, gst_number, fssai_number, outlet_image_url`,
    values
  );

  if (rows.length === 0) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  return toUserResponse(rows[0]);
}

async function updateOutletImage(userId, outletImageUrl) {
  const { rows } = await query(
    `UPDATE users
     SET outlet_image_url = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, phone, name, role, is_setup_completed, business_name, owner_name,
       alternate_contact, address, pincode, city_id, outlet_type,
       daily_order_volume, gst_number, fssai_number, outlet_image_url`,
    [outletImageUrl, userId]
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
  updateOutletImage,
  refreshAccessToken,
};
