const express = require('express');
const { optionalAuth } = require('../middleware/optionalAuth');
const { adminOrPricingKey } = require('../middleware/adminOrPricingKey');
const adminPricingController = require('../controllers/adminPricingController');

const router = express.Router();

router.post(
  '/pricing/update',
  optionalAuth,
  adminOrPricingKey,
  adminPricingController.updatePricing
);

module.exports = router;
