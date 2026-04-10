-- Соответствует api/init.js (ручной запуск без init-эндпоинта).
CREATE TABLE IF NOT EXISTS users (
  telegram_id BIGINT PRIMARY KEY,
  phone TEXT,
  mileage INTEGER DEFAULT 0,
  free_spin_available BOOLEAN DEFAULT TRUE
);
