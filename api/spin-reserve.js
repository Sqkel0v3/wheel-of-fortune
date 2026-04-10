import { sql } from "@vercel/postgres";

const KM_COST = 250;
const DEMO_IDS = new Set([821470232, 1106885262]);

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
    if (DEMO_IDS.has(telegramId)) {
      const { rows } = await sql`
        SELECT mileage, free_spin_available FROM users WHERE telegram_id = ${telegramId} LIMIT 1
      `;
      if (!rows.length) {
        return res.status(404).json({ error: "User not found" });
      }
      const u = rows[0];
      return res.status(200).json({
        mileage: Number(u.mileage),
        free_spin_available: Boolean(u.free_spin_available),
        demo: true,
      });
    }

    const { rows } = await sql`
      UPDATE users SET
        free_spin_available = CASE WHEN free_spin_available THEN FALSE ELSE free_spin_available END,
        mileage = CASE
          WHEN free_spin_available THEN mileage
          ELSE mileage - ${KM_COST}
        END
      WHERE telegram_id = ${telegramId}
        AND (free_spin_available OR mileage >= ${KM_COST})
      RETURNING telegram_id, mileage, free_spin_available
    `;

    if (!rows.length) {
      return res.status(403).json({
        error: "Not enough mileage",
        code: "INSUFFICIENT_KM",
      });
    }

    const u = rows[0];
    return res.status(200).json({
      mileage: Number(u.mileage),
      free_spin_available: Boolean(u.free_spin_available),
    });
  } catch (err) {
    console.error("spin-reserve:", err);
    return res.status(500).json({ error: "Database error" });
  }
}
