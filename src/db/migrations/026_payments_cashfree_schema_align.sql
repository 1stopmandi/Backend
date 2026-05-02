-- Align databases that already ran the legacy Stripe-oriented 023_add_payments.sql
-- (payment_intent_id, stripe_customer_id, payment_sessions.payment_intent_id / order_id)
-- with the Cashfree-neutral schema used by the current 023 file on fresh installs.

-- orders: move to provider_order_id
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(255);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_intent_id'
  ) THEN
    UPDATE orders
    SET provider_order_id = payment_intent_id
    WHERE provider_order_id IS NULL AND payment_intent_id IS NOT NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_orders_payment_intent;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_intent_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_order_id
  ON orders(provider_order_id) WHERE provider_order_id IS NOT NULL;

ALTER TABLE users DROP COLUMN IF EXISTS stripe_customer_id;

-- payment_sessions: rename legacy columns if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_sessions' AND column_name = 'payment_intent_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_sessions' AND column_name = 'provider_order_id'
  ) THEN
    ALTER TABLE payment_sessions RENAME COLUMN payment_intent_id TO provider_order_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_sessions' AND column_name = 'order_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_sessions' AND column_name = 'app_order_id'
  ) THEN
    ALTER TABLE payment_sessions RENAME COLUMN order_id TO app_order_id;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_payment_sessions_pi;
CREATE INDEX IF NOT EXISTS idx_payment_sessions_provider
  ON payment_sessions(provider_order_id);

ALTER TABLE payment_sessions ALTER COLUMN currency SET DEFAULT 'INR';
