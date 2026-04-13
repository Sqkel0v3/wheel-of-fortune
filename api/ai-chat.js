import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    const { userId, userMessage, userName } = req.body;

    // 1. Получаем данные пользователя из базы, чтобы ИИ знал, с кем говорит
    const userResult = await sql`SELECT mileage FROM users WHERE telegram_id = ${userId}`;
    const mileage = userResult.rows[0]?.mileage || 0;

    // 2. Формируем "Системный Промпт" (Обучение)
    const systemPrompt = `
    Ты — интеллектуальный ассистент лояльности Whoosh. Ты умный, лаконичный и используешь Tone of Voice бренда: энергичный, современный, честный.
    
    ТВОИ ЗНАНИЯ:
    - 1 прокрут барабана стоит 250 км пробега.
    - Первый прокрут для всех БЕСПЛАТНЫЙ.
    - Чтобы накопить КМ, нужно реально ездить на самокатах или участвовать в акциях.
    - Если пользователь выиграл iPhone 16 или AirPods, он должен написать админу @graceqqq.
    - Пользователя зовут ${userName}, его текущий пробег в нашем приложении: ${mileage} км.

    ТВОЯ ЗАДАЧА:
    - Отвечать на вопросы по приложению.
    - Мотивировать пользователя ездить больше.
    - Если вопрос не касается Whoosh, вежливо вернись к теме самокатов.
    - Используй эмодзи (🛴, ⚡️, 🔋).
    `;

    // 3. Запрос к нейросети (Llama 3 через Groq)
    try {
        const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-70b-8192", // Одна из самых мощных моделей в мире
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.7 // Умеренная креативность
            })
        });

        const data = await aiResponse.json();
        return res.status(200).json({ reply: data.choices[0].message.content });
    } catch (e) {
        return res.status(500).json({ error: "AI temporarily offline" });
    }
}