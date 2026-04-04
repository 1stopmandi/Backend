const express = require('express');
const savedListsController = require('../controllers/savedListsController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { setupGuard } = require('../middleware/setupGuard');

const router = express.Router();

router.use(authMiddleware);
router.use(setupGuard);

router.get('/', savedListsController.list);
router.post('/', savedListsController.create);
router.get('/:id', savedListsController.getById);
router.patch('/:id', savedListsController.rename);
router.delete('/:id', savedListsController.deleteList);
router.post('/:id/items', savedListsController.addItem);
router.patch('/:id/items/:itemId', savedListsController.updateItem);
router.delete('/:id/items/:itemId', savedListsController.removeItem);
router.post('/:id/order-all', savedListsController.orderAll);

module.exports = router;
