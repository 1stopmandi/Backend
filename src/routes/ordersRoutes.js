const express = require('express');
const ordersController = require('../controllers/ordersController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { setupGuard } = require('../middleware/setupGuard');

const router = express.Router();

router.use(authMiddleware);
router.use(setupGuard);

router.post('/', ordersController.create);
router.get('/', ordersController.list);
router.get('/last', ordersController.getLast);
router.post('/last/add-to-cart', ordersController.addLastToCart);
router.get('/:id', ordersController.getById);

module.exports = router;
