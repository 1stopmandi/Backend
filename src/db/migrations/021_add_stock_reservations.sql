-- Stock reservations for preventing overselling during checkout
CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quantity DECIMAL(12, 2) NOT NULL,
  reserved_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Indexes for queries
CREATE INDEX idx_stock_reservations_product ON stock_reservations(product_id);
CREATE INDEX idx_stock_reservations_user ON stock_reservations(user_id);
CREATE INDEX idx_stock_reservations_expires ON stock_reservations(expires_at);
CREATE INDEX idx_stock_reservations_product_expires ON stock_reservations(product_id, expires_at);

-- View to calculate available stock (excluding expired reservations)
CREATE OR REPLACE VIEW available_stock_view AS
SELECT
  p.id AS product_id,
  p.stock,
  COALESCE(SUM(sr.quantity), 0) AS reserved,
  p.stock - COALESCE(SUM(sr.quantity), 0) AS available
FROM products p
LEFT JOIN stock_reservations sr ON p.id = sr.product_id AND sr.expires_at > now()
GROUP BY p.id, p.stock;
