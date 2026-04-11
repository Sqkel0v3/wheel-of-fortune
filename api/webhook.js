import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // 1. Простая проверка метода
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
        // 2. Команда /start (срабатывает первой)
        if (text === '/start') {
            const welcomeText = `Привет, ${firstName}! 👋\n\nЯ — официальный AI-помощник Whoosh. Жми на кнопку, чтобы крутить барабан, или просто спроси меня о чем угодно! 🛴`;
            
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: welcomeText,
                    reply_markup: {
                        inline_keyboard: [[{
                            text: "🎁 Испытать удачу",
                            web_app: { url: `https://${req.headers.host}` }
                        }]]
                    }
                })
            });
            return res.status(200).send('ok');
        }

        // 3. Если это не /start — отправляем в ИИ
        // Статус "печатает..."
        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'typing' })
        });

        // Получаем данные из базы
        const userRes = await sql`SELECT mileage FROM users WHERE telegram_id = ${userId}`;
        const mileage = userRes.rows.length > 0 ? userRes.rows[0].mileage : 0;

        // Получаем ответ от ИИ
        const aiReply = await getAiResponse(text, firstName, mileage, groqKey);

        // Отправляем ответ пользователю
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: aiReply,
                parse_mode: 'HTML'
            })
        });

    } catch (e) {
        console.error("Ошибка:", e.message);
        // Если что-то упало, отправляем простое сообщение
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: "Извини, я немного отвлекся на дорогу. Попробуй еще раз! 🛴"
            })
        });
    }

    return res.status(200).send('ok');
}

async function getAiResponse(userMessage, userName, mileage, apiKey) {
    const spinsAvailable = Math.floor(mileage / 250);
    const kmToNextSpin = 250 - (mileage % 250);

    const systemPrompt = `
    Ты — AI-ассистент Whoosh. 
    
    ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
    - Имя: ${userName}
    - Баланс: ${mileage} км.
    - Доступно попыток КРУТИТЬ БАРАБАН: ${spinsAvailable}.
    - Нужно до СЛЕДУЮЩЕЙ попытки: ${kmToNextSpin} км.

    ПРАВИЛА ОТВЕТА (ВАЖНО!):
    1. Если у пользователя есть 1 или более попыток (сейчас у него ${spinsAvailable}), ПЕРВЫМ ДЕЛОМ скажи: "У тебя уже есть доступная попытка! Скорее открывай приложение и крути барабан! 🎡".
    2. НЕ ПИШИ, что ему нужно еще сколько-то км, чтобы получить шанс, если у него УЖЕ ЕСТЬ попытка. 
    3. Про 227 км (дистанция до СЛЕДУЮЩЕГО шанса) пиши только если он спросит: "А когда будет следующая попытка?".
    4. iPhone 16 — это супер-приз в барабане (шанс 0.01%). С 250 км он УЖЕ МОЖЕТ его выиграть, если повезет.
    5. Отвечай кратко (2-3 предложения), на русском, с эмодзи 🛴.
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
            temperature: 0.4, // Еще ниже, чтобы ИИ был строже
            max_tokens: 300
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}
