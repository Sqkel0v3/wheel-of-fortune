import { sql } from "@vercel/postgres";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const telegramId = body.telegramId != null ? Number(body.telegramId) : NaN;
  if (!Number.isFinite(telegramId)) {
    return res.status(400).json({ error: "Invalid telegramId" });
  }

  try {
    const { rows } = await sql`
      SELECT mileage, free_spin_available FROM users WHERE telegram_id = ${telegramId} LIMIT 1
    `;
    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }
    const u = rows[0];

    // Все пользователи крутят бесплатно, км не списываются
    return res.status(200).json({
      mileage: Number(u.mileage),
      free_spin_available: Boolean(u.free_spin_available),
      demo: true,
    });

  } catch (err) {
    console.error("spin-reserve:", err);
    return res.status(500).json({ error: "Database error" });
  }
}
