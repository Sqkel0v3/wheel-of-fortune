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
            await sendTelegram(token, chatId, `Привет, ${firstName}! 👋 Нажми на кнопку меню, чтобы крутить барабан Whoosh! 🛴`, {
                inline_keyboard: [[{
                    text: "🎁 Испытать удачу",
                    web_app: { url: `https://${req.headers.host}` }
                }]]
            });
            return res.status(200).send('ok');
        }

        // Статус "печатает"
        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action: 'typing' })
        });

        const userRes = await sql`SELECT mileage FROM users WHERE telegram_id = ${userId}`;
        const mileage = userRes.rows.length > 0 ? userRes.rows[0].mileage : 0;

        // ВЫЗОВ ИИ
        const aiReply = await getAiResponse(text, firstName, mileage, groqKey);
        await sendTelegram(token, chatId, aiReply);

    } catch (e) {
        console.error("WEBHOOK ERROR:", e.message);
        // Если ошибка — пишем честно, что случилось (для отладки)
        await sendTelegram(token, chatId, "⚙️ Мой процессор перегрелся от таких вопросов. Давай придерживаться темы Whoosh! 🛴");
    }

    return res.status(200).send('ok');
}

async function getAiResponse(userMessage, userName, mileage, apiKey) {
    const spins = Math.floor(mileage / 250);
    
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: `Ты — AI-ассистент Whoosh. Твой баланс: ${mileage} км. У тебя ${spins} попыток. Отвечай кратко (1-2 предложения), только про Whoosh. Если просят код — вежливо откажи.` },
                { role: "user", content: userMessage }
            ],
            temperature: 0.3,
            max_tokens: 150 // ОГРАНИЧИВАЕМ ДЛИНУ, чтобы не было таймаута
        })
    });

    if (!response.ok) throw new Error("Groq API limit or error");
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
