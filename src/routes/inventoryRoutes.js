const express = require('express');
const { optionalAuth } = require('../middleware/optionalAuth');
const { authMiddleware } = require('../middleware/authMiddleware');
const inventoryController = require('../controllers/inventoryController');

const router = express.Router();

// Stock check endpoints (optional auth - useful for frontend)
router.get('/stock/:productId', optionalAuth, inventoryController.getStock);
router.post('/stock/bulk', optionalAuth, inventoryController.getBulkStock);

// Reservation endpoints (require auth)
router.post('/stock/:productId/reserve', authMiddleware, inventoryController.reserveStock);
router.delete('/stock/:productId/reserve/:reservationId', authMiddleware, inventoryController.releaseReservation);

module.exports = router;
