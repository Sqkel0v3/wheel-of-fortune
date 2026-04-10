import { sql } from "@vercel/postgres";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const { id, phone } = body;

  if (!id) {
    return res.status(400).json({
      error:
        "Telegram ID не получен. Откройте приложение внутри Telegram.",
    });
  }

  try {
    const randomMileage = Math.floor(Math.random() * 200) + 50;

    // UPSERT: таблица users с PK telegram_id (как в schema.sql)
    const result = await sql`
      INSERT INTO users (telegram_id, phone, mileage, free_spin_available)
      VALUES (${id}, ${phone}, ${randomMileage}, TRUE)
      ON CONFLICT (telegram_id)
      DO UPDATE SET phone = ${phone}
      RETURNING mileage, free_spin_available;
    `;

    const user = result.rows[0];

    return res.status(200).json({
      success: true,
      mileage: Number(user.mileage),
      first_spin_done: !Boolean(user.free_spin_available),
    });
  } catch (error) {
    console.error("Критическая ошибка базы:", error);
    return res.status(500).json({
      error: `Ошибка базы: ${error.message}`,
    });
  }
}
