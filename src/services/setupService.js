const { query } = require('../db');

const OUTLET_TYPES = new Set([
  'restaurant',
  'hotel',
  'caterer',
  'cloud_kitchen',
  'event_planner',
]);

async function getStatus(userId) {
  const { rows } = await query(
    `SELECT is_setup_completed, setup_step,
            business_name, owner_name, address, pincode, city_id, outlet_type
     FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const user = rows[0];

  if (user.is_setup_completed) {
    return {
      is_setup_completed: true,
      step: null,
      missing_fields: [],
    };
  }

  const stepNum = user.setup_step != null ? Number(user.setup_step) : 0;
  if (stepNum >= 2) {
    return {
      is_setup_completed: false,
      step: 2,
      missing_fields: [],
    };
  }
  if (stepNum >= 1) {
    return {
      is_setup_completed: false,
      step: 2,
      missing_fields: [],
    };
  }
  return {
    is_setup_completed: false,
    step: 1,
    missing_fields: [],
  };
}

async function saveStep1(userId, data) {
  const {
    business_name,
    owner_name,
    alternate_contact,
    address,
    city_id,
    pincode,
    outlet_type,
    daily_order_volume,
    outlet_image_url,
  } = data;

  if (!business_name || !String(business_name).trim()) {
    const err = new Error('business_name is required');
    err.status = 400;
    throw err;
  }
  if (!owner_name || !String(owner_name).trim()) {
    const err = new Error('owner_name is required');
    err.status = 400;
    throw err;
  }
  if (!address || !String(address).trim()) {
    const err = new Error('address is required');
    err.status = 400;
    throw err;
  }
  if (!city_id) {
    const err = new Error('city_id is required');
    err.status = 400;
    throw err;
  }
  if (!pincode || !String(pincode).trim()) {
    const err = new Error('pincode is required');
    err.status = 400;
    throw err;
  }
  if (!outlet_type || !OUTLET_TYPES.has(String(outlet_type))) {
    const err = new Error(
      `outlet_type must be one of: ${[...OUTLET_TYPES].join(', ')}`
    );
    err.status = 400;
    throw err;
  }

  const { rows: cityCheck } = await query(
    'SELECT 1 FROM cities WHERE id = $1 AND is_active = true',
    [city_id]
  );
  if (cityCheck.length === 0) {
    const err = new Error('Invalid or inactive city_id');
    err.status = 400;
    throw err;
  }

  const { rows } = await query(
    `UPDATE users SET
      business_name = $1, owner_name = $2, alternate_contact = $3,
      address = $4, city_id = $5, pincode = $6, outlet_type = $7,
      daily_order_volume = $8, outlet_image_url = $9,
      setup_step = GREATEST(setup_step, 1),
      updated_at = now()
     WHERE id = $10
     RETURNING id, business_name, owner_name, alternate_contact, address,
       city_id, pincode, outlet_type, daily_order_volume, outlet_image_url,
       is_setup_completed, setup_step`,
    [
      String(business_name).trim(),
      String(owner_name).trim(),
      alternate_contact || null,
      String(address).trim(),
      city_id,
      String(pincode).trim(),
      String(outlet_type),
      daily_order_volume || null,
      outlet_image_url || null,
      userId,
    ]
  );

  if (rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  return rows[0];
}

async function saveStep2(userId, data) {
  const { gst_number, fssai_number, gst_cert_url, fssai_cert_url } = data;

  const { rows } = await query(
    `UPDATE users SET
      gst_number = $1, fssai_number = $2, gst_cert_url = $3, fssai_cert_url = $4,
      setup_step = GREATEST(setup_step, 2),
      updated_at = now()
     WHERE id = $5
     RETURNING id, gst_number, fssai_number, gst_cert_url, fssai_cert_url, setup_step`,
    [
      gst_number || null,
      fssai_number || null,
      gst_cert_url || null,
      fssai_cert_url || null,
      userId,
    ]
  );

  if (rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  return rows[0];
}

async function complete(userId) {
  const { rows: check } = await query(
    `SELECT business_name, owner_name, address, pincode, city_id, outlet_type,
            is_setup_completed, setup_step
     FROM users WHERE id = $1`,
    [userId]
  );
  if (check.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const u = check[0];
  if (u.is_setup_completed) {
    const { rows } = await query(
      `SELECT id, phone, name, role, is_setup_completed, city_id FROM users WHERE id = $1`,
      [userId]
    );
    return { user: rows[0] };
  }

  if (Number(u.setup_step) < 2) {
    const err = new Error('Complete step 2 before finishing setup');
    err.status = 400;
    err.code = 'SETUP_VALIDATION';
    err.missing_fields = ['step2'];
    throw err;
  }

  const missing = [];
  if (!u.business_name) missing.push('business_name');
  if (!u.owner_name) missing.push('owner_name');
  if (!u.address) missing.push('address');
  if (!u.pincode) missing.push('pincode');
  if (!u.city_id) missing.push('city_id');
  if (!u.outlet_type) missing.push('outlet_type');

  if (missing.length > 0) {
    const err = new Error('Complete step 1 before finishing setup');
    err.status = 400;
    err.code = 'SETUP_VALIDATION';
    err.missing_fields = missing;
    throw err;
  }

  await query(
    `UPDATE users SET is_setup_completed = true, updated_at = now() WHERE id = $1`,
    [userId]
  );

  const { rows } = await query(
    `SELECT id, phone, name, role, is_setup_completed, city_id FROM users WHERE id = $1`,
    [userId]
  );

  return { user: rows[0] };
}

module.exports = {
  getStatus,
  saveStep1,
  saveStep2,
  complete,
  OUTLET_TYPES,
};
