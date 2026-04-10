export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

  if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.error("send-prize: BOT_TOKEN or ADMIN_CHAT_ID is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { name, prize, promoCode } = req.body || {};
  if (name == null || prize == null) {
    return res.status(400).json({ error: "Missing name or prize" });
  }

  console.log("Отправка сообщения через нового бота...");

  let text =
    "\uD83C\uDF81 Новый победитель!\nИмя: " + name + "\nПриз: " + prize;
  if (promoCode != null && String(promoCode).trim() !== "") {
    text += "\nПромокод: " + String(promoCode).trim();
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text }),
    });

    let tgData = {};
    try {
      tgData = await tgRes.json();
    } catch {
      tgData = {};
    }

    if (!tgRes.ok || !tgData.ok) {
      console.error("send-prize: Telegram API error", tgData);
      return res.status(502).json({
        error: tgData.description || "Telegram API error",
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("send-prize:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
}
