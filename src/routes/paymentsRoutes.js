const express = require('express');
const paymentsController = require('../controllers/paymentsController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { setupGuard } = require('../middleware/setupGuard');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────
// ORDER MATTERS — DO NOT REORDER
// 1) /webhook MUST be first and use express.raw so Cashfree signature verification
//    receives the raw body string (same position as express.json() guard in index.js).
// 2) authMiddleware MUST NOT apply to /webhook (Cashfree is not a logged-in user).
// ─────────────────────────────────────────────────────────────────────────

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentsController.webhook
);

router.use(authMiddleware);
router.use(setupGuard);

router.post(
  '/checkout',
  rateLimit({
    key: (req) => `pay-checkout:${req.user.id}`,
    max: 5,
    windowMs: 60_000,
  }),
  paymentsController.createCheckout
);

router.get(
  '/cf-order/:providerOrderId/status',
  rateLimit({
    key: (req) => `pay-poll:${req.user.id}`,
    max: 120,
    windowMs: 60_000,
  }),
  paymentsController.getCfOrderStatus
);

module.exports = router;
