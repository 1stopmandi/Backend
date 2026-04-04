const express = require('express');
const cartController = require('../controllers/cartController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { setupGuard } = require('../middleware/setupGuard');

const router = express.Router();

router.use(authMiddleware);
router.use(setupGuard);

router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.delete('/items/:productId', cartController.removeItem);
router.patch('/items/:productId', cartController.updateItem);
router.post('/validate', cartController.validateCart);
router.post('/clear', cartController.clearCart);

module.exports = router;
