ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_step SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_setup_step'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_setup_step
      CHECK (setup_step >= 0 AND setup_step <= 2);
  END IF;
END $$;

UPDATE users SET setup_step = 2
WHERE is_setup_completed = true AND setup_step < 2;

UPDATE users SET setup_step = 1
WHERE NOT is_setup_completed
  AND (business_name IS NOT NULL OR address IS NOT NULL)
  AND setup_step = 0;
