const express = require('express');
const adminUsersController = require('../controllers/adminUsersController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/users', adminUsersController.listUsers);
router.patch('/users/:id/role', adminUsersController.setRole);

module.exports = router;
