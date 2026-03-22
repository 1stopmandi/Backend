CREATE TABLE saved_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE saved_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_list_id UUID NOT NULL REFERENCES saved_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  default_quantity DECIMAL(12, 2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(saved_list_id, product_id)
);

CREATE INDEX idx_saved_lists_user ON saved_lists(user_id);
CREATE INDEX idx_saved_list_items_list ON saved_list_items(saved_list_id);
