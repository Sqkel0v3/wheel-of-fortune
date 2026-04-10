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
  const id = body.id != null ? Number(body.id) : NaN;
  const phone = normalizePhone(body.phone);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }
  if (!phone) {
    return res.status(400).json({ error: "Invalid phone" });
  }

  try {
    const found = await sql`
      SELECT telegram_id FROM users WHERE telegram_id = ${id} LIMIT 1
    `;

    if (!found.rows.length) {
      const mileage = randomMileage();
      const { rows } = await sql`
        INSERT INTO users (telegram_id, phone, mileage, free_spin_available)
        VALUES (${id}, ${phone}, ${mileage}, TRUE)
        RETURNING mileage, free_spin_available
      `;
      const u = rows[0];
      return res.status(200).json({
        mileage: Number(u.mileage),
        first_spin_done: !Boolean(u.free_spin_available),
      });
    }

    const { rows } = await sql`
      UPDATE users SET phone = ${phone} WHERE telegram_id = ${id}
      RETURNING mileage, free_spin_available
    `;
    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }
    const u = rows[0];
    return res.status(200).json({
      mileage: Number(u.mileage),
      first_spin_done: !Boolean(u.free_spin_available),
    });
  } catch (err) {
    console.error("save-user:", err);
    return res.status(500).json({ error: "Database error" });
  }
}
