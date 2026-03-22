const express = require('express');
const setupController = require('../controllers/setupController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { uploadFields } = require('../middleware/upload');

const router = express.Router();

router.use(authMiddleware);

router.get('/status', setupController.getStatus);
router.post('/step1', uploadFields, setupController.step1);
router.post('/step2', uploadFields, setupController.step2);
router.post('/complete', setupController.complete);

module.exports = router;
