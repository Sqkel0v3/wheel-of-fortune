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
    const totalSpins = Math.floor(mileage / 250);
    
    const systemPrompt = `
    Ты — официальный ассистент программы лояльности Whoosh. 
    
    ТВОИ ДАННЫЕ ДЛЯ РАБОТЫ:
    - Имя пользователя: ${userName}.
    - Текущий баланс: ${mileage} КМ. Это не дистанция для одной поездки, это БАЛАНС, накопленный за всё время.
    - Доступно попыток крутить барабан прямо сейчас: ${spinsAvailable}.
    
    ТВОЯ ЗАДАЧА:
    1. Если пользователь спрашивает, что делать с КМ, отвечай: "Твой баланс — ${mileage} КМ. Этого хватает на ${spinsAvailable} попыток в нашем барабане! 🎡". 
    2. Никогда не предлагай "рассчитать путешествие" на 273 км. Это глупо для самокатов.
    3. Про iPhone говори четко: "iPhone 16 можно выиграть только в барабане. Это супер-приз, для него нужна удача! 🍀". Не называй это "призом за активность".
    4. Отвечай коротко (до 2-3 предложений), на грамотном русском языке.
    
    Тон общения: Энергичный, профессиональный, как в приложении Whoosh. 🛴
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
            temperature: 0.3 // Сделает его менее склонным к "фантазиям"
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}
