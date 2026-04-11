import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    const token = process.env.BOT_TOKEN;
    const groqKey = process.env.GROQ_API_KEY; // Проверь это имя в Vercel!
    const body = req.body;

    if (!body || !body.message) return res.status(200).send('OK');

    const chatId = body.message.chat.id;
    const text = body.message.text;
    const userId = body.message.from.id;
    const firstName = body.message.from.first_name || "друг";

    // 1. Команда /start
    if (text === '/start') {
        const welcomeText = `Привет, ${firstName}! 👋\n\nЯ — AI-помощник Whoosh. Жми на кнопку, чтобы крутить барабан, или просто спроси меня о чем угодно! 🛴`;
        await sendTelegramMessage(token, chatId, welcomeText, {
            inline_keyboard: [[{
                text: "🎁 Испытать удачу",
                web_app: { url: `https://${req.headers.host}` }
            }]]
        });
        return res.status(200).send('ok');
    }

    // 2. Статус "печатает..."
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' })
    });

    try {
        // Проверка наличия ключа
        if (!groqKey) throw new Error("API ключ GROQ_API_KEY не найден в Vercel");

        // Получаем пробег (безопасно)
        let mileage = 0;
        try {
            const userRes = await sql`SELECT mileage FROM users WHERE telegram_id = ${userId}`;
            if (userRes.rows.length > 0) mileage = userRes.rows[0].mileage;
        } catch (dbErr) {
            console.error("DB Error:", dbErr);
        }

        const aiReply = await getAiResponse(text, firstName, mileage, groqKey);
        await sendTelegramMessage(token, chatId, aiReply);
    } catch (e) {
        console.error("Критическая ошибка:", e.message);
        // Бот честно скажет причину ошибки тебе (как админу)
        const errorMsg = `⚠️ Ошибка ИИ: ${e.message}\n\nПроверь настройки Vercel и лимиты Groq.`;
        await sendTelegramMessage(token, chatId, errorMsg);
    }

    return res.status(200).send('ok');
}

async function getAiResponse(userMessage, userName, mileage, apiKey) {
    // Улучшенный системный промпт
    const systemPrompt = `
    Ты — официальный AI-ассистент Whoosh. 
    Твоя задача: помогать пользователям в Telegram-боте.
    
    ОСНОВНЫЕ ПРАВИЛА:
    1. Отвечай СТРОГО на русском языке. Никаких иностранных слов.
    2. Будь энергичным, вежливым и используй эмодзи (🛴, ⚡️, 🏁).
    3. Контекст пользователя: Имя — ${userName}, Пробег — ${mileage} км.
    4. Информация о призах: 1 прокрут = 250 км. Первый раз — бесплатно. За iPhone 16 пиши админу @graceqqq.
    5. Отвечай кратко и по делу (максимум 2-3 предложения).
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
            max_tokens: 300,
            temperature: 0.6 // Снизили температуру для большей стабильности языка
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "Groq API Error");
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function sendTelegramMessage(token, chatId, text, replyMarkup = null) {
    const body = { chat_id: chatId, text: text, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}
