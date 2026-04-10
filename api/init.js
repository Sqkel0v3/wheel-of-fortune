import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Проверяем, есть ли вообще переменные окружения
  if (!process.env.POSTGRES_URL) {
    return res.status(500).json({ 
      error: "База данных не подключена! Зайди в Vercel -> Storage и нажми Connect." 
    });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        phone TEXT,
        mileage INTEGER DEFAULT 0,
        first_spin_done BOOLEAN DEFAULT FALSE
      );
    `;
    return res.status(200).json({ message: "Таблица проверена/создана успешно!" });
  } catch (error) {
    console.error("Ошибка БД:", error);
    return res.status(500).json({ 
      error: "Ошибка при создании таблицы",
      details: error.message 
    });
  }
}
