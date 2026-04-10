import { sql } from "@vercel/postgres";

function randomMileage() {
  return 50 + Math.floor(Math.random() * (300 - 50 + 1));
}

function normalizePhone(input) {
  const d = String(input || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) {
    return "+7" + d.slice(1);
  }
  if (d.length === 10) {
    return "+7" + d;
  }
  if (d.length === 11 && d.startsWith("7")) {
    return "+" + d;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const telegramId = body.telegramId != null ? Number(body.telegramId) : NaN;
  const phone = normalizePhone(body.phone);

  if (!Number.isFinite(telegramId)) {
    return res.status(400).json({ error: "Invalid telegramId" });
  }
  if (!phone) {
    return res.status(400).json({ error: "Invalid phone" });
  }

  const mileage = randomMileage();

  try {
    const { rows } = await sql`
      INSERT INTO users (telegram_id, phone, mileage, free_spin_available)
      VALUES (${telegramId}, ${phone}, ${mileage}, TRUE)
      ON CONFLICT (telegram_id) DO UPDATE SET phone = EXCLUDED.phone
      RETURNING telegram_id, phone, mileage, free_spin_available
    `;
    const u = rows[0];
    return res.status(200).json({
      telegram_id: String(u.telegram_id),
      phone: u.phone,
      mileage: Number(u.mileage),
      free_spin_available: Boolean(u.free_spin_available),
    });
  } catch (err) {
    console.error("register:", err);
    return res.status(500).json({ error: "Database error" });
  }
}
