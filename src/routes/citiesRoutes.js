const express = require('express');
const citiesController = require('../controllers/citiesController');
const { optionalAuth } = require('../middleware/optionalAuth');
const { adminOrPricingKey } = require('../middleware/adminOrPricingKey');

const router = express.Router();

// Public GET routes
router.get('/', citiesController.list);
router.get('/:cityId/zones', citiesController.getZonesByCity);
router.get('/:id', citiesController.getById);

// Admin POST routes (with auth middleware)
router.post('/resolve', optionalAuth, adminOrPricingKey, citiesController.resolveByPincode);

module.exports = router;
