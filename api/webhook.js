import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    const token = process.env.BOT_TOKEN;
    const body = req.body;

    if (!body || !body.message) return res.status(200).send('OK');

    const chatId = body.message.chat.id;
    const text = body.message.text;
    const userId = body.message.from.id;
    const firstName = body.message.from.first_name || "друг";

    // 1. Команда /start (Приветствие и кнопка)
    if (text === '/start') {
        const welcomeText = `Привет, ${firstName}! 👋\n\nЯ — интеллектуальный помощник Whoosh. У меня ты можешь испытать удачу и выиграть бонусы для поездок!\n\nЖми на кнопку ниже, а если возникнут вопросы — просто напиши мне! 🛴`;
        
        await sendTelegramMessage(token, chatId, welcomeText, {
            inline_keyboard: [[{
                text: "🎁 Испытать удачу",
                web_app: { url: `https://${req.headers.host}` }
            }]]
        });
        return res.status(200).send('ok');
    }

    // 2. Все остальные сообщения — отправляем в ИИ (Llama 3 через Groq)
    // Сначала показываем статус "печатает...", чтобы было реалистично
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' })
    });

    try {
        // Получаем пробег из базы для контекста ИИ
        const userRes = await sql`SELECT mileage FROM users WHERE telegram_id = ${userId}`;
        const mileage = userRes.rows[0]?.mileage || 0;

        const aiReply = await getAiResponse(text, firstName, mileage);
        await sendTelegramMessage(token, chatId, aiReply);
    } catch (e) {
        console.error("AI Error:", e);
        await sendTelegramMessage(token, chatId, "Извини, я немного перегрелся во время поездки. Попробуй написать чуть позже! 🔋");
    }

    return res.status(200).send('ok');
}

// Функция общения с ИИ
async function getAiResponse(userMessage, userName, mileage) {
    const systemPrompt = `Ты — умный AI-ассистент Whoosh. Твой стиль: технологичный, вежливый, энергичный. 
    Ты знаешь, что:
    - 1 прокрут барабана стоит 250 км пробега.
    - Первый прокрут — бесплатно.
    - Призы: iPhone 16 (связь с @graceqqq), бонусы, подписки (промокоды).
    - Пользователь: ${userName}, его пробег: ${mileage} км.
    Отвечай кратко, используй эмодзи. Не говори, что ты робот.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama3-70b-8192",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ]
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

// Функция отправки сообщений в Telegram
async function sendTelegramMessage(token, chatId, text, replyMarkup = null) {
    const body = { chat_id: chatId, text: text, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = replyMarkup;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}
