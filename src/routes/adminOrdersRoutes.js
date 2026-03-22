const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/requireAdmin');
const adminOrdersController = require('../controllers/adminOrdersController');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.patch('/orders/:id/status', adminOrdersController.patchStatus);

module.exports = router;
