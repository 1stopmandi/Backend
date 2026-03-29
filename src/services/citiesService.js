const { query } = require('../db');

function toCityResponse(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    is_active: row.is_active,
  };
}

function toZoneResponse(row) {
  return {
    id: row.id,
    city_id: row.city_id,
    name: row.name,
    slug: row.slug,
    is_active: row.is_active,
    sort_order: row.sort_order,
  };
}

async function list(active = true) {
  const { rows } = await query(
    `SELECT id, name, slug, is_active
     FROM cities
     WHERE is_active = $1
     ORDER BY name ASC`,
    [active]
  );
  return rows.map(toCityResponse);
}

async function getById(id) {
  const { rows } = await query(
    `SELECT id, name, slug, is_active
     FROM cities
     WHERE id = $1`,
    [id]
  );
  return rows.length > 0 ? toCityResponse(rows[0]) : null;
}

async function getZonesByCityId(cityId) {
  const { rows } = await query(
    `SELECT id, city_id, name, slug, is_active, sort_order
     FROM delivery_zones
     WHERE city_id = $1 AND is_active = true
     ORDER BY sort_order ASC`,
    [cityId]
  );
  return rows.map(toZoneResponse);
}

function validatePincodeFormat(pincode) {
  // Validate exactly 6 digits
  if (!pincode || typeof pincode !== 'string' || !/^\d{6}$/.test(pincode)) {
    const err = new Error('Invalid pincode format. Must be exactly 6 digits.');
    err.status = 400;
    throw err;
  }
}

async function resolvePincodeToCity(pincode) {
  // Validate pincode format first
  validatePincodeFormat(pincode);

  // Try to find a matching prefix (longest match first: 6 digits, then 5, then 4, etc.)
  for (let prefixLen = 6; prefixLen >= 3; prefixLen--) {
    const prefix = pincode.substring(0, prefixLen);

    const { rows } = await query(
      `SELECT 
         c.id as city_id,
         c.name as city_name,
         c.slug as city_slug,
         c.is_active as city_active,
         dz.id as zone_id,
         dz.name as zone_name,
         dz.slug as zone_slug,
         dz.is_active as zone_active,
         dz.sort_order
       FROM pincode_mappings pm
       JOIN cities c ON pm.city_id = c.id
       JOIN delivery_zones dz ON pm.zone_id = dz.id
       WHERE pm.pincode_prefix = $1
       LIMIT 1`,
      [prefix]
    );

    if (rows.length > 0) {
      const row = rows[0];
      return {
        city: {
          id: row.city_id,
          name: row.city_name,
          slug: row.city_slug,
          is_active: row.city_active,
        },
        zone: {
          id: row.zone_id,
          name: row.zone_name,
          slug: row.zone_slug,
          is_active: row.zone_active,
          sort_order: row.sort_order,
        },
      };
    }
  }

  // No matching pincode found
  const err = new Error('Pincode not found or delivery not available in this area');
  err.status = 404;
  throw err;
}

module.exports = { list, getById, getZonesByCityId, resolvePincodeToCity };
