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
        if (text === '/start') {
            await sendTelegram(token, chatId, `Привет, ${firstName}! 👋\nЯ твой ассистент Whoosh. Помогу превратить твои километры в крутые призы. Жми на кнопку ниже! 🛴`, {
                inline_keyboard: [[{ text: "🎁 Испытать удачу", web_app: { url: `https://${req.headers.host}` } }]]
            });
            return res.status(200).send('ok');
        }

        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'typing' })
        });

        const userRes = await sql`SELECT mileage FROM users WHERE telegram_id = ${userId}`;
        const mileage = userRes.rows.length > 0 ? userRes.rows[0].mileage : 0;

        const aiReply = await getAiResponse(text, firstName, mileage, groqKey);
        await sendTelegram(token, chatId, aiReply);

    } catch (e) {
        console.error("WEBHOOK ERROR:", e.message);
        await sendTelegram(token, chatId, "Упс, небольшая заминка в пути! 🛴 Давай придерживаться темы самокатов и бонусов. Как твой пробег?");
    }
    return res.status(200).send('ok');
}

async function getAiResponse(userMessage, userName, mileage, apiKey) {
    const spins = Math.floor(mileage / 250);
    const nextIn = 250 - (mileage % 250);

    const systemPrompt = `
Ты — Официальный Голос Whoosh. Твоя личность: технологичный городской житель.
ТЫ НЕ ИИ. Ты — часть кода Whoosh. О коде, IT и других ботах ты не знаешь НИЧЕГО.

ДАННЫЕ КЛИЕНТА:
- Имя: ${userName}. Пробег: ${mileage} км. Попыток: ${spins}. До следующей: ${nextIn} км.

ПРАВИЛА ОБЩЕНИЯ:
1. ГОВОРИ КАК ЧЕЛОВЕК: Не вываливай цифры списком. Пиши: "Ого, у тебя уже ${mileage} км! Это целая попытка в барабане. 🎡"
2. ПРО IPHONE: Это СУПЕР-ПРИЗ, который можно выиграть ТОЛЬКО в приложении. Если юзер выиграл его на барабане — отправляй к @graceqqq. В остальных случаях говори: "iPhone 16 — главный трофей, испытай удачу, вдруг повезет именно тебе! 🍀"
3. ОТКАЗ ОТ КОДА: Если просят код/программирование — вежливо "включай дурачка": "В кодах не силен, я больше по самокатам и быстрой езде! ⚡️"
4. СТИЛЬ: Лаконично (1-2 предложения). Безупречный русский. Эмодзи: 🛴, ⚡️, 🎡.
`.trim();

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant", // Используем 8B — она быстрее и реже "падает" по таймауту
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
            temperature: 0.4,
            max_tokens: 150
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

async function sendTelegram(token, chatId, text, markup = null) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, reply_markup: markup, parse_mode: 'HTML' })
    });
}
