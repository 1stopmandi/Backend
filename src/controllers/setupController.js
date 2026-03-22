const setupService = require('../services/setupService');

function getFileUrl(file) {
  if (!file || !file.filename) return null;
  return `/uploads/${file.filename}`;
}

async function getStatus(req, res) {
  const data = await setupService.getStatus(req.user.id);
  if (!data) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data });
}

async function step1(req, res) {
  const outlet_image_url = getFileUrl(req.files?.outlet_image?.[0]);
  const data = {
    ...req.body,
    outlet_image_url: outlet_image_url || req.body.outlet_image_url,
    city_id: req.body.city_id || null,
  };
  const result = await setupService.saveStep1(req.user.id, data);
  res.json({ success: true, data: result });
}

async function step2(req, res) {
  const gst_cert_url = getFileUrl(req.files?.gst_cert?.[0]) || req.body.gst_cert_url;
  const fssai_cert_url = getFileUrl(req.files?.fssai_cert?.[0]) || req.body.fssai_cert_url;
  const data = {
    gst_number: req.body.gst_number,
    fssai_number: req.body.fssai_number,
    gst_cert_url,
    fssai_cert_url,
  };
  const result = await setupService.saveStep2(req.user.id, data);
  res.json({ success: true, data: result });
}

async function complete(req, res) {
  const result = await setupService.complete(req.user.id);
  res.json({ success: true, data: result });
}

module.exports = { getStatus, step1, step2, complete };
