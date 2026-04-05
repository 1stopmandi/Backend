const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/requireAdmin');
const adminOrdersController = require('../controllers/adminOrdersController');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/orders/stats', adminOrdersController.getStats);    
router.get('/orders', adminOrdersController.listOrders);  
router.get('/orders/:id', adminOrdersController.getById); 
router.patch('/orders/:id/status', adminOrdersController.patchStatus);
router.post('/orders/:id/tracking', adminOrdersController.addTracking);

module.exports = router;
