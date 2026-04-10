import { sql } from "@vercel/postgres";

function parseTelegramId(q) {
  const raw = q.telegramId ?? q.telegram_id;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const telegramId = parseTelegramId(req.query || {});
  if (telegramId == null) {
    return res.status(400).json({ error: "Missing telegramId" });
  }

  try {
    const { rows } = await sql`
      SELECT telegram_id, phone, mileage, free_spin_available
      FROM users
      WHERE telegram_id = ${telegramId}
      LIMIT 1
    `;
    if (!rows.length) {
      return res.status(404).json({ error: "Not registered" });
    }
    const u = rows[0];
    return res.status(200).json({
      telegram_id: String(u.telegram_id),
      phone: u.phone,
      mileage: Number(u.mileage),
      free_spin_available: Boolean(u.free_spin_available),
    });
  } catch (err) {
    console.error("me:", err);
    return res.status(500).json({ error: "Database error" });
  }
}
