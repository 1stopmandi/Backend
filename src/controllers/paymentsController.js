const paymentsService = require('../services/paymentsService');
const { query } = require('../db');

/**
 * POST /api/payments/checkout — create Cashfree order + payment session from cart snapshot.
 */
async function createCheckout(req, res) {
  const { rows } = await query(
    'SELECT address, pincode FROM users WHERE id = $1',
    [req.user.id]
  );
  const u = rows[0];
  if (!u?.address?.trim() || !u?.pincode?.trim()) {
    const err = new Error('Delivery address and pincode are required');
    err.status = 409;
    err.code = 'ADDRESS_REQUIRED';
    throw err;
  }

  const data = await paymentsService.createCheckoutSession(req.user.id);
  res.status(200).json({ success: true, data });
}

/**
 * POST /api/payments/webhook — Cashfree notify_url (raw JSON body for signature verification).
 */
async function webhook(req, res, next) {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];

    const rawBuf = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(String(req.body ?? ''), 'utf8');
    const rawBody = rawBuf.toString('utf8');

    if (!signature || !timestamp) {
      console.warn('[PaymentsWebhook] missing signature or timestamp headers');
      const err = new Error('Missing webhook signature headers');
      err.status = 400;
      throw err;
    }

    const cf = paymentsService.getCashfree();
    cf.PGVerifyWebhookSignature(signature, rawBody, timestamp);

    let payload;
    try {
      payload = JSON.parse(rawBody || '{}');
    } catch (e) {
      console.error('[PaymentsWebhook] invalid JSON body');
      const err = new Error('Invalid webhook body');
      err.status = 400;
      throw err;
    }

    const eventType = payload.type || payload.event || '';
    const providerOrderId =
      payload?.data?.order?.order_id ||
      payload?.data?.order_id ||
      payload?.order?.order_id ||
      payload?.order_id;

    console.log(
      '[PaymentsWebhook] event=',
      eventType,
      'order_id=',
      providerOrderId,
      'preview=',
      rawBody.slice(0, 280)
    );

    const t = String(eventType).toUpperCase();
    if (t.includes('SUCCESS') && t.includes('PAYMENT')) {
      if (providerOrderId) {
        await paymentsService.finalizeFromCashfreeWebhook(providerOrderId);
      }
    } else if (
      t.includes('FAILED') ||
      t.includes('DROPPED') ||
      t.includes('CANCELLED')
    ) {
      if (providerOrderId) {
        await paymentsService.markPaymentSessionCancelled(providerOrderId);
      }
    } else {
      console.log('[PaymentsWebhook] ignored event type', eventType);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/payments/cf-order/:providerOrderId/status
 * — Cashfree order_status for the current user (see getCashfreeOrderStatusForUser).
 */
async function getCfOrderStatus(req, res, next) {
  try {
    const providerOrderId = req.params.providerOrderId;
    if (!providerOrderId || !String(providerOrderId).trim()) {
      const err = new Error('providerOrderId is required');
      err.status = 400;
      throw err;
    }
    const data = await paymentsService.getCashfreeOrderStatusForUser(
      providerOrderId,
      req.user.id
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCheckout,
  webhook,
  getCfOrderStatus,
};
