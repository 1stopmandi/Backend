#!/usr/bin/env node
/**
 * Bulk pricing update from JSON. See docs/PRICING-SLABS-SPEC.md §4
 * Usage: node scripts/update-pricing.js --file ./daily-prices.json
 * Env: API_BASE_URL, ADMIN_PRICING_KEY
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  let file = 'daily-prices.json';
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--file' && args[i + 1]) {
      file = args[i + 1];
      i += 1;
    }
  }
  return { file };
}

async function resolveCitySlug(slug) {
  if (!slug) return null;
  const base = process.env.API_BASE_URL || 'http://localhost:3000';
  const url = `${base.replace(/\/$/, '')}/api/cities`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET /api/cities failed: ${res.status}`);
  const body = await res.json();
  const list = body.data || body;
  const arr = Array.isArray(list) ? list : [];
  const found = arr.find((c) => c.slug === String(slug).toLowerCase());
  return found ? found.id : null;
}

async function postUpdate(payload) {
  const base = process.env.API_BASE_URL || 'http://localhost:3000';
  const key = process.env.ADMIN_PRICING_KEY;
  if (!key) {
    throw new Error('ADMIN_PRICING_KEY is not set');
  }
  const url = `${base.replace(/\/$/, '')}/api/admin/pricing/update`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': key,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { message: text };
  }
  if (!res.ok) {
    const msg = body.message || text || res.status;
    throw new Error(msg);
  }
  return body;
}

async function main() {
  const { file } = parseArgs();
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(abs, 'utf8');
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) {
    console.error('JSON root must be an array');
    process.exit(1);
  }

  let failed = false;
  for (const entry of entries) {
    const slug = entry.slug;
    const base_price = entry.base_price;
    const slabs = entry.slabs || [];
    try {
      let city_id = null;
      if (entry.city) {
        city_id = await resolveCitySlug(entry.city);
        if (!city_id) {
          console.error(`[fail] ${slug}: city not found: ${entry.city}`);
          failed = true;
          continue;
        }
      }
      await postUpdate({
        slug,
        base_price,
        city_id,
        slabs: slabs.map((s, i) => ({
          min_qty: s.min_qty,
          max_qty: s.max_qty == null ? null : s.max_qty,
          price_per_unit: s.price_per_unit,
          sort_order: s.sort_order != null ? s.sort_order : i + 1,
        })),
      });
      console.log(`[ok] ${slug}`);
    } catch (e) {
      console.error(`[fail] ${slug}:`, e.message);
      failed = true;
    }
  }

  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
