import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    const { userId, userMessage, userName } = req.body;

    let mileage = 0;
    try {
        const userResult = await sql`SELECT mileage FROM users WHERE telegram_id = ${userId}`;
        mileage = userResult.rows[0]?.mileage || 0;
    } catch (e) {
        console.error("DB error:", e.message);
    }

    const spins = Math.floor(mileage / 250);
    const nextIn = 250 - (mileage % 250);

    const systemPrompt = `Ты — ассистент программы лояльности Whoosh (кикшеринг самокатов). Отвечай ТОЛЬКО на русском языке.

ФАКТЫ ОБ АКЦИИ:
• Первый прокрут барабана — бесплатный для каждого нового участника.
• Каждый следующий прокрут стоит 250 км накопленного пробега.
• Километры копятся за реальные поездки на самокатах Whoosh (нужно привязать телефон в приложении).
• Призы: iPhone 16 (0.01%), AirPods 4, Whoosh Pass на год, промокоды на скидки и бесплатные старты.
• Для получения физического приза (iPhone/AirPods) нужно написать @graceqqq.

ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
• Имя: ${userName}
• Пробег: ${mileage} км
• Доступно прокрутов: ${spins}
• До следующего прокрута: ${nextIn} км

ПРАВИЛА ОТВЕТА:
• Отвечай коротко — максимум 3–4 предложения.
• Не придумывай факты, которых нет выше.
• Если вопрос не касается Whoosh — вежливо переведи тему обратно.
• Используй 1–2 эмодзи: 🛴 ⚡️ 🏆`.trim();

    try {
        const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.4,
                max_tokens: 200
            })
        });

        const data = await aiResponse.json();
        const reply = data.choices?.[0]?.message?.content?.trim();
        return res.status(200).json({ reply: reply || "Попробуй переформулировать вопрос 🛴" });
    } catch (e) {
        console.error("AI error:", e.message);
        return res.status(500).json({ error: "AI temporarily offline" });
    }
}
