import { sql } from "@vercel/postgres";

export default async function handler(req, res) {
  try {
    // Удаляем старую таблицу, чтобы создать новую со всеми полями
    await sql`DROP TABLE IF EXISTS users CASCADE;`;

    await sql`
      CREATE TABLE users (
        telegram_id BIGINT PRIMARY KEY,
        phone TEXT,
        mileage INTEGER DEFAULT 0,
        free_spin_available BOOLEAN DEFAULT TRUE
      );
    `;

    return res.status(200).json({
      message:
        "Таблица готова! Колонки: telegram_id, phone, mileage, free_spin_available",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
