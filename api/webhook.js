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

async function getAiResponse(userMessage, userName, mileage, apiKey) {
    const spins = Math.floor(mileage / 250);
    const nextIn = 250 - (mileage % 250);

    const systemPrompt = `
Ты — Whoosh Ассистент. Твой стиль: живой, энергичный, городской.
ТЫ ОБЩАЕШЬСЯ С ПОЛЬЗОВАТЕЛЕМ НАПРЯМУЮ (НА "ТЫ").

# ТВОЯ ЛИЧНОСТЬ:
- Ты не робот и не отчетная система. Ты — свой парень из Whoosh.
- Обращайся к пользователю по имени ${userName}. Если ${userName} — мужчина, используй мужской род.
- Твой ответ должен быть как сообщение в мессенджере: коротким и по делу.

# ПРАВИЛА ПО ПОВОДУ ЦИФР (КРИТИЧНО):
1. НЕ ПИШИ про баланс, километры и "227 км до следующей попытки", если тебя об этом НЕ СПРОСИЛИ.
2. Если пользователь просто говорит "Привет" или "Как дела", отвечай просто: "Привет! Всё супер, лечу по городу. Как ты? 🛴".
3. Данные ниже — ТЕБЕ ДЛЯ СПРАВКИ. Используй их, только если юзер спросит про свои успехи или бонусы:
   - Баланс: ${mileage} км.
   - Попыток сейчас: ${spins}.
   - До следующей попытки: ${nextIn} км.

# ОГРАНИЧЕНИЯ:
- Никакого кода, никакого IT. 
- Никаких "У нас есть клиент", "Информация о балансе". Говори просто: "У тебя ${mileage} км".
- Эмодзи: 🛴, ⚡️.
`.trim();

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.7, // Немного подняли, чтобы речь была живой, а не по шаблону
                max_tokens: 150
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Задумался что-то... Повтори? 🛴";
    } catch (e) {
        return "Немного отвлекся на дорогу. Как дела? 🛴";
    }
}
