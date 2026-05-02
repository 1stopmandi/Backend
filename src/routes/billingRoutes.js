const express = require('express');
const billingController = require('../controllers/billingController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { setupGuard } = require('../middleware/setupGuard');

const router = express.Router();

router.use(authMiddleware);
router.use(setupGuard);

router.get('/summary', billingController.summary);
router.get('/orders', billingController.orders);

module.exports = router;
