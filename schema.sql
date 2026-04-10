-- Vercel Postgres: выполните в консоли Storage / SQL или через migrate.
CREATE TABLE IF NOT EXISTS users (
  telegram_id BIGINT PRIMARY KEY,
  phone TEXT NOT NULL,
  mileage INTEGER NOT NULL CHECK (mileage >= 0),
  free_spin_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
