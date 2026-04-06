-- Add reservation tracking to cart items
ALTER TABLE cart_items ADD COLUMN reservation_id UUID REFERENCES stock_reservations(id) ON DELETE SET NULL;

-- Index for quick lookup
CREATE INDEX idx_cart_items_reservation ON cart_items(reservation_id);
