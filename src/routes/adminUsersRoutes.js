const express = require('express');
const adminUsersController = require('../controllers/adminUsersController');
const { authMiddleware }   = require('../middleware/authMiddleware');
const { requireAdmin }     = require('../middleware/requireAdmin');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/users/stats',         adminUsersController.getStats);      // new — before /:id
router.get('/users',               adminUsersController.listUsers);
router.get('/users/:id',           adminUsersController.getById);       // new
router.get('/users/:id/orders',    adminUsersController.getUserOrders); // new
router.patch('/users/:id/role',    adminUsersController.setRole);
router.patch('/users/:id/block',   adminUsersController.blockUser);     // new
router.post('/users/promote',      adminUsersController.promoteByPhone); // was dead code

module.exports = router;