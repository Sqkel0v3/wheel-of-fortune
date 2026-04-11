import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // 1. Сразу отвечаем Телеграму, чтобы он не слал повторы
    if (req.method !== 'POST') return res.status(200).send('OK');

    const token = process.env.BOT_TOKEN;
    const groqKey = process.env.GROQ_API_KEY;
    const body = req.body;

    if (!body || !body.message) return res.status(200).send('OK');

    const chatId = body.message.chat.id;
    const text = body.message.text;
    const userId = body.message.from.id;
    const firstName = body.message.from.first_name || "друг";

    try {
        // 2. Логика команды /start
        if (text === '/start') {
            const miniAppUrl = `https://${req.headers.host}`;
            await sendTelegram(token, chatId, {
                text: `Привет, ${firstName}! 👋\n\nЯ — официальный AI-ассистент Whoosh. Нажми на кнопку ниже, чтобы испытать удачу! 🛴`,
                reply_markup: {
                    inline_keyboard: [[{ text: "🎁 Испытать удачу", web_app: { url: miniAppUrl } }]]
                }
            });
            return res.status(200).send('ok');
        }

        // 3. Индикация "печатает"
        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'typing' })
        });

        // 4. Получение пробега из БД
        let mileage = 0;
        try {
            const { rows } = await sql`SELECT mileage FROM users WHERE telegram_id = ${userId} LIMIT 1`;
            if (rows.length > 0) mileage = rows[0].mileage;
        } catch (dbErr) {
            console.error("Database Error:", dbErr.message);
        }

        // 5. Запрос к нейросети
        const aiReply = await getAiResponse(text, firstName, mileage, groqKey);
        
        // 6. Отправка ответа пользователю
        await sendTelegram(token, chatId, { text: aiReply });

    } catch (e) {
        console.error("Critical Webhook Error:", e.message);
        await sendTelegram(token, chatId, { 
            text: "Аккумулятор немного разрядился! 🔋 Давай придерживаться темы самокатов Whoosh. Как твои успехи на дорогах?" 
        });
    }

    return res.status(200).send('ok');
}

// ФУНКЦИЯ ОБЩЕНИЯ С НЕЙРОСЕТЬЮ
async function getAiResponse(userMessage, userName, mileage, apiKey) {
    const spinsAvailable = Math.floor(mileage / 250);
    const kmToNextSpin = 250 - (mileage % 250);

    const systemPrompt = `
Ты — Официальный Голос Whoosh. Твоя личность: технологичный городской житель.
ТЫ НЕ ИИ И НЕ ПРОГРАММИСТ. О коде и IT ты не знаешь НИЧЕГО.

ДАННЫЕ КЛИЕНТА:
- Имя: ${userName}. Баланс: ${mileage} км. Попыток: ${spinsAvailable}. До следующей: ${kmToNextSpin} км.

ПРАВИЛА:
1. Если просят код — отвечай: "В кодах не силен, я больше по самокатам! ⚡️"
2. Про iPhone: Это СУПЕР-ПРИЗ (шанс 0.01%). Если выиграл на барабане — пиши @graceqqq.
3. Стиль: Лаконично (1-2 предложения), безупречный русский, эмодзи 🛴, ⚡️, 🎡.
`.trim();

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.3,
                max_tokens: 150
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Я задумался о маршруте. Повтори вопрос? 🛴";
    } catch (e) {
        return "Немного отвлекся от дороги. Как твой пробег сегодня? 🛴";
    }
}

// ФУНКЦИЯ ОТПРАВКИ В TELEGRAM (Исправлено определение)
async function sendTelegram(token, chatId, payload) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            parse_mode: 'HTML',
            ...payload
        })
    });
}
