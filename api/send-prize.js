function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.BOT_TOKEN;
  const adminId = process.env.ADMIN_CHAT_ID;
  if (!token || !adminId) {
    console.error("send-prize: BOT_TOKEN or ADMIN_CHAT_ID missing");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const body = req.body || {};
  const name = body.name;
  const prize = body.prize;
  const promoCode = body.promoCode;
  const userId = body.userId;
  const prizeStr = prize != null ? String(prize) : "";
  const isPhysical =
    prizeStr.includes("iPhone") ||
    prizeStr.includes("AirPods") ||
    !!body.isPhysical;

  if (name == null || prize == null) {
    return res.status(400).json({ error: "Missing name or prize" });
  }

  const safeName = escapeHtml(name);
  const safePrize = escapeHtml(prize);
  const safePromo =
    promoCode != null && String(promoCode).trim() !== ""
      ? escapeHtml(String(promoCode).trim())
      : "";

  let text = "";
  if (isPhysical) {
    text +=
      "\uD83D\uDEA8 <b>\u0424\u0418\u0417\u0418\u0427\u0415\u0421\u041a\u0418\u0419 \u041f\u0420\u0418\u0417! \u0421\u0420\u041e\u0427\u041d\u041e \u0421\u0412\u042F\u0416\u0418\u0422\u0415\u0421\u042C \u0421 \u041f\u041e\u0411\u0415\u0414\u0418\u0422\u0415\u041b\u0415\u041c!</b>\n\n";
  }
  text +=
    "\uD83C\uDF81 <b>\u041d\u041e\u0412\u042b\u0419 \u0412\u042b\u0418\u0413\u0420\u042b\u0428!</b>\n\n" +
    "\uD83D\uDC64 \u0418\u043c\u044f: " +
    safeName +
    "\n\uD83C\uDFC6 \u041f\u0440\u0438\u0437: " +
    safePrize;

  if (!isPhysical && safePromo) {
    text += "\n\uD83C\uDF9F \u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434: <code>" + safePromo + "</code>";
  }

  const url = "https://api.telegram.org/bot" + token + "/sendMessage";

  try {
    const tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminId,
        text,
        parse_mode: "HTML",
      }),
    });

    let tgData = {};
    try {
      tgData = await tgRes.json();
    } catch {
      tgData = {};
    }

    if (!tgRes.ok || !tgData.ok) {
      console.error("send-prize: Telegram error", tgData);
      return res.status(502).json({
        error: tgData.description || "Telegram API error",
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-prize:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
}
