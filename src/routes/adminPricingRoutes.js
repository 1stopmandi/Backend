const express = require('express');
const { optionalAuth } = require('../middleware/optionalAuth');
const { adminOrPricingKey } = require('../middleware/adminOrPricingKey');
const adminPricingController = require('../controllers/adminPricingController');

const router = express.Router();

router.use(optionalAuth, adminOrPricingKey);

router.get('/pricing/products', adminPricingController.listProducts);
router.get('/pricing/:productId', adminPricingController.getByProduct);
router.get('/pricing/:productId/audit', adminPricingController.getAuditLog);
router.post('/pricing/update', adminPricingController.updatePricing);
router.delete('/pricing/:productId', adminPricingController.deactivatePricing);

module.exports = router;