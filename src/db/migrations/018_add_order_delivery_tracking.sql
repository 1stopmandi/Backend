CREATE TABLE order_delivery_tracking (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status       VARCHAR(50) NOT NULL,
  note         TEXT,
  location     VARCHAR(200),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_delivery_tracking_order
  ON order_delivery_tracking(order_id, created_at DESC);

-- seed initial tracking entry when order is created
-- (trigger keeps tracking in sync with order status)
CREATE OR REPLACE FUNCTION trg_order_tracking_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_delivery_tracking (order_id, status, note)
    VALUES (
      NEW.id,
      NEW.status,
      CASE NEW.status
        WHEN 'confirmed'        THEN 'Order confirmed by vendor'
        WHEN 'out_for_delivery' THEN 'Order picked up for delivery'
        WHEN 'delivered'        THEN 'Order delivered successfully'
        WHEN 'cancelled'        THEN 'Order cancelled'
        ELSE NULL
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_status_tracking
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_order_tracking_on_status_change();