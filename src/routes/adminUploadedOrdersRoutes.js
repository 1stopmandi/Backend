const express = require('express');
const uploadedOrdersController = require('../controllers/uploadedOrdersController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/', uploadedOrdersController.listPending);
router.patch('/:id/ready', uploadedOrdersController.markReady);
router.patch('/:id/rejected', uploadedOrdersController.markRejected);

module.exports = router;
