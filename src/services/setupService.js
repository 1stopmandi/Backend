const { query } = require('../db');

const OUTLET_TYPES = ['Restaurant', 'Hotel', 'Caterer', 'Cloud Kitchen', 'Event Planner'];

function getStep(user) {
  if (user.is_setup_completed) return 'complete';
  if (user.business_name && user.address) return 2;
  return 1;
}

async function getStatus(userId) {
  const { rows } = await query(
    `SELECT is_setup_completed, business_name, address
     FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  return {
    is_setup_completed: user.is_setup_completed,
    step: getStep(user),
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

  if (!business_name || !address) {
    const err = new Error('business_name and address are required');
    err.status = 400;
    throw err;
  }

  if (outlet_type && !OUTLET_TYPES.includes(outlet_type)) {
    const err = new Error(`outlet_type must be one of: ${OUTLET_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const { rows } = await query(
    `UPDATE users SET
      business_name = $1, owner_name = $2, alternate_contact = $3,
      address = $4, city_id = $5, pincode = $6, outlet_type = $7,
      daily_order_volume = $8, outlet_image_url = $9, updated_at = now()
     WHERE id = $10
     RETURNING id, business_name, owner_name, alternate_contact, address,
       city_id, pincode, outlet_type, daily_order_volume, outlet_image_url,
       is_setup_completed`,
    [
      business_name,
      owner_name || null,
      alternate_contact || null,
      address,
      city_id || null,
      pincode || null,
      outlet_type || null,
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
      updated_at = now()
     WHERE id = $5
     RETURNING id, gst_number, fssai_number, gst_cert_url, fssai_cert_url`,
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
  const { rows } = await query(
    `UPDATE users SET is_setup_completed = true, updated_at = now()
     WHERE id = $1
     RETURNING id, is_setup_completed`,
    [userId]
  );

  if (rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  return rows[0];
}

module.exports = {
  getStatus,
  saveStep1,
  saveStep2,
  complete,
  OUTLET_TYPES,
};
