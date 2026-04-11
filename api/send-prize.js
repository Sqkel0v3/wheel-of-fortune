function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.BOT_TOKEN;
  const adminId = process.env.ADMIN_CHAT_ID;
  const groqKey = process.env.GROQ_API_KEY; // Твой ключ от нейросети

  if (!token || !adminId) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { name, prize, promoCode, userId } = req.body || {};
  const prizeStr = prize != null ? String(prize) : "";
  
  // Проверка на крупный приз
  const isPhysical = prizeStr.includes("iPhone") || prizeStr.includes("AirPods");

  if (name == null || prize == null) {
    return res.status(400).json({ error: "Missing name or prize" });
  }

  const safeName = escapeHtml(name);
  const safePrize = escapeHtml(prize);
  const safePromo = promoCode ? escapeHtml(String(promoCode).trim()) : "";

  let messageText = "";

  // ЭТАП 1: ГЕНЕРАЦИЯ ТЕКСТА (ЧЕРЕЗ ИИ ИЛИ СТАНДАРТНО)
  if (isPhysical && groqKey) {
    try {
      const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "Ты — бизнес-аналитик Whoosh. Напиши краткое, серьезное и грамотное уведомление для владельца о том, что клиент выиграл СУПЕР-ПРИЗ. Используй официальный стиль, укажи имя и приз. Не используй лишней болтовни."
            },
            {
              role: "user",
              content: `Имя клиента: ${safeName}, Выигранный приз: ${safePrize}`
            }
          ],
          temperature: 0.3
        })
      });

      const aiData = await aiResponse.json();
      const aiText = aiData.choices[0].message.content;
      messageText = `🚨 <b>VIP УВЕДОМЛЕНИЕ</b> 🚨\n\n${aiText}\n\n👤 Имя: ${safeName}\n🏆 Приз: ${safePrize}`;
    } catch (e) {
      console.error("AI notification error:", e);
      messageText = `🚨 <b>ФИЗИЧЕСКИЙ ПРИЗ!</b>\n\n👤 Имя: ${safeName}\n🏆 Приз: ${safePrize}\n⚠️ Свяжитесь с победителем!`;
    }
  } else {
    // Обычный формат для бонусов и скидок
    messageText = `🎁 <b>НОВЫЙ ВЫИГРЫШ</b>\n\n👤 Имя: ${safeName}\n🏆 Приз: ${safePrize}`;
    if (safePromo) {
      messageText += `\n🎫 Промокод: <code>${safePromo}</code>`;
    }
  }

  // ЭТАП 2: ОТПРАВКА В TELEGRAM
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminId,
        text: messageText,
        parse_mode: "HTML",
      }),
    });

    if (!tgRes.ok) throw new Error("Telegram API error");

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-prize fail:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
}
