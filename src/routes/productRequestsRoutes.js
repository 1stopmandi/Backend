const express = require('express');
const productRequestsController = require('../controllers/productRequestsController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { setupGuard } = require('../middleware/setupGuard');
const { uploadProductRequestImage } = require('../middleware/upload');

const router = express.Router();

router.use(authMiddleware);
router.use(setupGuard);

router.post('/', uploadProductRequestImage, productRequestsController.create);
router.get('/', productRequestsController.list);

module.exports = router;
