ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked     BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked)
  WHERE is_blocked = true;