import { sql } from '@vercel/postgres';

// Главная функция-обработчик
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
        // 1. ОБРАБОТКА КОМАНДЫ /START
        if (text === '/start') {
            const miniAppUrl = `https://${req.headers.host}`;
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `Привет, ${firstName}! 👋\n\nЯ твой ассистент Whoosh. Помогу превратить твои километры в крутые призы.\n\nЖми на кнопку ниже, чтобы испытать удачу! 🛴`,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[{ text: "🎁 Испытать удачу", web_app: { url: miniAppUrl } }]]
                    }
                })
            });
            return res.status(200).send('ok');
        }

        // 2. ИНДИКАЦИЯ ПЕЧАТИ
        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'typing' })
        });

        // 3. ПОЛУЧЕНИЕ ДАННЫХ ИЗ БАЗЫ
        let mileage = 0;
        try {
            const { rows } = await sql`SELECT mileage FROM users WHERE telegram_id = ${userId} LIMIT 1`;
            if (rows.length > 0) mileage = rows[0].mileage;
        } catch (dbErr) {
            console.error("Database Error:", dbErr.message);
        }

        // 4. ЗАПРОС К ИИ
        const aiReply = await getAiResponse(text, firstName, mileage, groqKey);
        
        // 5. ОТПРАВКА ОТВЕТА
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
        console.error("Critical Error:", e.message);
        // Запасное сообщение
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: "Немного отвлекся от дороги. Как твой пробег сегодня? 🛴"
            })
        });
    }

    return res.status(200).send('ok');
}

// ФУНКЦИЯ ОБЩЕНИЯ С ИИ
async function getAiResponse(userMessage, userName, mileage, apiKey) {
    const spins = Math.floor(mileage / 250);
    const nextIn = 250 - (mileage % 250);

    const systemPrompt = `
Ты — ассистент Whoosh. Общайся с пользователем на "ТЫ". Твой стиль — живой, дерзкий, мужской.
Имя пользователя — ${userName}. 

ПРАВИЛА:
1. НЕ ПИСАТЬ про 227 км, 273 км и баланс, если тебя об этом НЕ СПРОСИЛИ. 
2. Если пользователь просто здоровается или спрашивает "Как дела", отвечай по-человечески: "Привет! Всё круто, лечу по делам на самокате. У тебя как успехи? ⚡️".
3. Твой баланс ${mileage} км и ${spins} попыток — это секретная инфа, выдавай её только на вопросы про призы или статистику.
4. НИКАКОГО КОДА. Ты не знаешь, что такое React или Python. Ты знаешь только Whoosh.
5. Ответ: 1-2 коротких предложения.
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
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
                temperature: 0.8,
                max_tokens: 150
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Задумался о маршруте... Повтори? 🛴";
    } catch (e) {
        return "Аккумулятор сел, давай позже! 🔋";
    }
}
