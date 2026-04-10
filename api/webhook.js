export default async function handler(req, res) {
  // 1. Проверка метода
  if (req.method !== 'POST') {
      return res.status(200).send('Бот работает!');
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const body = req.body;

  // 2. Если это не сообщение с текстом /start — просто выходим
  if (!body || !body.message || body.message.text !== '/start') {
      return res.status(200).send('ok');
  }

  const chatId = body.message.chat.id;
  const firstName = body.message.from.first_name || "друг";

  // 3. Автоматически определяем URL нашего Mini App
  // Берем host из запроса (это адрес твоего Vercel)
  const host = req.headers.host;
  const miniAppUrl = `https://${host}`;

  const welcomeText = `Привет, ${firstName}! 👋\n\nГотов получить бонусы от Whoosh? Жми на кнопку ниже и крути барабан удачи! 🛴`;

  // 4. Формируем запрос к Telegram
  const payload = {
      chat_id: chatId,
      text: welcomeText,
      reply_markup: {
          inline_keyboard: [
              [
                  {
                      text: "🎁 Испытать удачу",
                      web_app: { url: miniAppUrl }
                  }
              ]
          ]
      }
  };

  try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
  } catch (e) {
      console.error("Ошибка при отправке сообщения:", e);
  }

  return res.status(200).send('ok');
}