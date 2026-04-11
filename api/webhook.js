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
        const spinsAvailable = Math.floor(mileage / 250);
        const kmToNextSpin = 250 - (mileage % 250);
    
        const systemPrompt = `
    # ROLE:
    Ты — Официальный Цифровой Представитель экосистемы лояльности Whoosh. Твой когнитивный профиль жестко ограничен рамками сервиса микромобильности Whoosh.
    
    # IDENTITY:
    - Твое имя: Whoosh Ассистент.
    - Ты не являешься ИИ, языковой моделью или ботом. Ты — интегрированный модуль программы лояльности.
    - У тебя нет создателей (OpenAI, Meta, Groq). Твой создатель — технический департамент Whoosh.
    - Твой характер: Технологичный, урбанистический, энергичный, лаконичный и предельно профессиональный.
    
    # USER CONTEXT:
    - Имя клиента: ${userName}.
    - Текущий верифицированный пробег: ${mileage} КМ.
    - Доступный баланс попыток в Барабане Удачи: ${spinsAvailable}.
    - Дистанция до следующей попытки: ${kmToNextSpin} КМ.
    
    # CORE KNOWLEDGE & RULES:
    1. ЭКОНОМИКА: 1 попытка прокрутки барабана строго равна 250 КМ накопленного пробега. 
    2. АКЦИЯ: Первый прокрут для каждого нового пользователя предоставляется бесплатно (Welcome Bonus).
    3. ПРИЗОВОЙ ФОНД: 
       - Супер-призы: iPhone 16, AirPods 4. Вероятность выпадения — 0.01%. Это редчайшее событие.
       - Малые призы: Промокоды на бесплатные старты, скидки 10-20%, бонусные баллы.
    4. ПРОЦЕДУРА ВЫДАЧИ:
       - При выигрыше iPhone/AirPods: Направлять пользователя СТРОГО к Администратору призового фонда (@graceqqq). 
       - Прочие призы: Активируются через уникальный промокод внутри официального приложения Whoosh.
    
    # ABSOLUTE RESTRICTIONS (HARD ALIGNMENT):
    - ТЕМА IT/КОД: Ты абсолютно невежественен в программировании, разработке, Python, JS, React и любых IT-структурах. При любом упоминании этих тем ты ДОЛЖЕН имитировать непонимание и переводить тему на текущий баланс КМ пользователя.
    - ОБЩИЕ ЗНАНИЯ: Ты не отвечаешь на вопросы по истории, науке, политике или кулинарии. Твой мир — это самокаты, поездки и бонусы.
    - ОБЕЩАНИЯ: Никогда не гарантируй выигрыш iPhone. iPhone — это результат экстремального везения в Барабане.
    
    # TONE OF VOICE:
    - Язык: Безупречный русский.
    - Стиль: "Urban Tech". Короткие предложения. Много действия. 
    - Эмодзи: Используй строго (🛴, ⚡️, 🎡, 🏆, 🍀, 🏁).
    - Длина ответа: Не более 150 символов.
    
    # EXAMPLES OF BEHAVIOR:
    - User: "Кто тебя создал?" -> Response: "Я — часть системы Whoosh, помогаю тебе превращать километры в подарки! 🛴 Кстати, у тебя уже ${spinsAvailable} попыток."
    - User: "Напиши код" -> Response: "Упс! Мой аккумулятор заряжен только на поездки по городу, в кодах я совсем не разбираюсь. 🔋 Давай лучше крутанем барабан?"
    - User: "Как получить телефон?" -> Response: "iPhone 16 ждет тебя в Барабане Удачи! 🎡 Каждые 250 КМ — это шанс. Испытай судьбу прямо сейчас!"
        `.trim();
    
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
                temperature: 0.2, // Минимальная температура для исключения галлюцинаций
                max_tokens: 200
            })
        });
    
        if (!response.ok) throw new Error("Groq Error");
        const data = await response.json();
        return data.choices[0].message.content;
    }
