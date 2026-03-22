CREATE TABLE uploaded_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'processing',
  cart_ready_at TIMESTAMPTZ,
  processed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE uploaded_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_order_id UUID NOT NULL REFERENCES uploaded_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(uploaded_order_id, product_id)
);

CREATE INDEX idx_uploaded_orders_user ON uploaded_orders(user_id);
CREATE INDEX idx_uploaded_orders_status ON uploaded_orders(status);
CREATE INDEX idx_uploaded_order_items_order ON uploaded_order_items(uploaded_order_id);
