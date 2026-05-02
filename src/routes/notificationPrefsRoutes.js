const express = require('express');
const notificationPrefsController = require('../controllers/notificationPrefsController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { setupGuard } = require('../middleware/setupGuard');

const router = express.Router();

router.use(authMiddleware);
router.use(setupGuard);

router.get('/', notificationPrefsController.getMyPreferences);
router.patch('/', notificationPrefsController.updateMyPreferences);

module.exports = router;
