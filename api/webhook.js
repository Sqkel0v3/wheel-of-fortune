import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
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
        // 1. Команда /start
        if (text === '/start') {
            await sendTelegram(token, chatId, `Привет, ${firstName}! 👋\n\nЯ — официальный AI-ассистент Whoosh. Жми на кнопку, чтобы крутить барабан, или просто спроси меня о чем угодно! 🛴`, {
                inline_keyboard: [[{
                    text: "🎁 Испытать удачу",
                    web_app: { url: `https://${req.headers.host}` }
                }]]
            });
            return res.status(200).send('ok');
        }

        // 2. Статус "печатает"
        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'typing' })
        });

        // 3. Получаем данные из базы для контекста ИИ
        const userRes = await sql`SELECT mileage FROM users WHERE telegram_id = ${userId}`;
        const mileage = userRes.rows.length > 0 ? userRes.rows[0].mileage : 0;

        // 4. ВЫЗОВ ИИ (с жестким промптом)
        const aiReply = await getAiResponse(text, firstName, mileage, groqKey);
        await sendTelegram(token, chatId, aiReply);

    } catch (e) {
        console.error("WEBHOOK ERROR:", e.message);
        await sendTelegram(token, chatId, "⚙️ Мой аккумулятор немного перегрелся. Давай придерживаться темы Whoosh и бонусов! 🛴");
    }

    return res.status(200).send('ok');
}

async function getAiResponse(userMessage, userName, mileage, apiKey) {
    const spins = Math.floor(mileage / 250);
    const nextIn = 250 - (mileage % 250);

    const systemPrompt = `
    Ты — официальный чат-бот компании Whoosh. ТЫ НЕ ПРОГРАММИСТ.
    
    ТВОИ ЖЕСТКИЕ ПРАВИЛА:
    1. Ты не знаешь, что такое код, React, Python или IT. Если тебя просят написать код или структуру проекта — ОТКАЖИ.
    2. Отвечай: "Упс! Я всего лишь ассистент Whoosh и совсем не понимаю в коде. Давай лучше посмотрим на твои ${mileage} КМ? 🛴"
    3. Твои знания: баланс (${mileage} КМ), попытки (${spins}), призы (iPhone 16 у @graceqqq).
    4. Отвечай кратко (1-2 предложения), на русском, с эмодзи 🛴, 🎡.
    `;

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
            temperature: 0.2, // Минимальная креативность для строгости
            max_tokens: 150
        })
    });

    if (!response.ok) throw new Error("Groq API Error");
    const data = await response.json();
    return data.choices[0].message.content;
}

async function sendTelegram(token, chatId, text, markup = null) {
    const body = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (markup) body.reply_markup = markup;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}
