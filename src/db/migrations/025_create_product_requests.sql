CREATE TABLE IF NOT EXISTS product_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  category_id UUID REFERENCES categories(id),
  expected_qty NUMERIC(10,2),
  unit VARCHAR(20),
  expected_price NUMERIC(12,2),
  purchase_frequency VARCHAR(20),
  notes TEXT,
  image_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_requests_status_check
    CHECK (status IN ('pending', 'reviewed', 'added', 'rejected')),
  CONSTRAINT product_requests_frequency_check
    CHECK (
      purchase_frequency IS NULL OR
      purchase_frequency IN ('one_time', 'daily', 'weekly', 'monthly')
    )
);

CREATE INDEX IF NOT EXISTS idx_product_requests_user
  ON product_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_requests_status
  ON product_requests(status);
