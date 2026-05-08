import { sql } from "@vercel/postgres";

const DEMO_ADMIN_IDS = new Set([821470232, 1106885262, 897790339]);
const DELTA = 50;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const telegramId = body.telegramId != null ? Number(body.telegramId) : NaN;
  if (!Number.isFinite(telegramId) || !DEMO_ADMIN_IDS.has(telegramId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const { rows } = await sql`
      UPDATE users
      SET mileage = mileage + ${DELTA}
      WHERE telegram_id = ${telegramId}
      RETURNING mileage
    `;
    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json({ mileage: Number(rows[0].mileage) });
  } catch (err) {
    console.error("add-demo-km:", err);
    return res.status(500).json({ error: "Database error" });
  }
}
