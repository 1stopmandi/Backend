-- Order payment metadata (provider-neutral naming)
ALTER TABLE orders
  ADD COLUMN payment_provider     VARCHAR(20),
  ADD COLUMN provider_order_id    VARCHAR(255),
  ADD COLUMN payment_status       VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  ADD COLUMN paid_at              TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_orders_provider_order_id
  ON orders(provider_order_id) WHERE provider_order_id IS NOT NULL;

-- Backfill: existing pre-gateway orders settled out-of-band
UPDATE orders
SET payment_status = 'manual_settlement',
    payment_provider = 'manual'
WHERE created_at < now();

-- Cart snapshot table — locked at PG order creation time
CREATE TABLE payment_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_order_id VARCHAR(255) UNIQUE,
  status            VARCHAR(20) NOT NULL DEFAULT 'created',
  -- status values: created | consumed | cancelled | expired
  amount_total      NUMERIC(12,2) NOT NULL,
  currency          VARCHAR(10)  NOT NULL DEFAULT 'INR',
  saved_list_id     UUID,
  uploaded_order_id UUID,
  delivery_address  TEXT,
  delivery_pincode  VARCHAR(20),
  delivery_city_id  UUID,
  items             JSONB        NOT NULL,
  app_order_id      UUID         REFERENCES orders(id),
  expires_at        TIMESTAMPTZ  NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_sessions_user_status
  ON payment_sessions(user_id, status);

CREATE INDEX idx_payment_sessions_provider
  ON payment_sessions(provider_order_id);
