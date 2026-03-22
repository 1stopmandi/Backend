const { query } = require('../db');

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH, 10) || 4;
const OTP_EXPIRY_MIN = parseInt(process.env.OTP_EXPIRY_MIN, 10) || 10;
const OTP_RATE_LIMIT_S = parseInt(process.env.OTP_RATE_LIMIT_S, 10) || 60;

// In-memory rate limit: phone -> lastSentAt (ms)
const rateLimitMap = new Map();

function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

function normalizePhone(phone) {
  return phone.replace(/\D/g, '');
}

function generateOtp() {
  const max = Math.pow(10, OTP_LENGTH) - 1;
  const num = Math.floor(Math.random() * (max + 1));
  return num.toString().padStart(OTP_LENGTH, '0');
}

function checkRateLimit(phone) {
  const key = normalizePhone(phone);
  const lastSent = rateLimitMap.get(key);
  if (!lastSent) return true;
  const elapsed = (Date.now() - lastSent) / 1000;
  return elapsed >= OTP_RATE_LIMIT_S;
}

function setRateLimit(phone) {
  rateLimitMap.set(normalizePhone(phone), Date.now());
}

async function createOtp(phone) {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);

  await query(
    `INSERT INTO otp_codes (phone, code, expires_at)
     VALUES ($1, $2, $3)`,
    [normalizePhone(phone), code, expiresAt]
  );

  return { code, expiresAt };
}

async function validateOtp(phone, otp) {
  const phoneNorm = normalizePhone(phone);
  const { rows } = await query(
    `SELECT id, code, expires_at
     FROM otp_codes
     WHERE phone = $1 AND used_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT 1`,
    [phoneNorm]
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.code !== otp.trim()) return null;

  await query(
    'UPDATE otp_codes SET used_at = now() WHERE id = $1',
    [row.id]
  );

  return true;
}

module.exports = {
  validatePhone,
  normalizePhone,
  checkRateLimit,
  setRateLimit,
  createOtp,
  validateOtp,
  OTP_EXPIRY_SEC: OTP_EXPIRY_MIN * 60,
};
