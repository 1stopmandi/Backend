const express = require('express');
const uploadedOrdersController = require('../controllers/uploadedOrdersController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { setupGuard } = require('../middleware/setupGuard');
const { uploadOrderImage } = require('../middleware/upload');

const router = express.Router();

router.use(authMiddleware);
router.use(setupGuard);

router.post('/', uploadOrderImage, uploadedOrdersController.create);
router.get('/', uploadedOrdersController.list);
router.get('/:id', uploadedOrdersController.getById);
router.delete('/:id', uploadedOrdersController.deleteUpload);
router.post('/:id/add-to-cart', uploadedOrdersController.addToCart);

module.exports = router;
