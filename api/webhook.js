/**
 * Базовый HTTPS URL Mini App (без завершающего /).
 * Задайте в Vercel: WEBAPP_URL = https://ваш-проект.vercel.app
 * или свой домен. Если пусто, используется VERCEL_URL от Vercel.
 */
function getMiniAppUrl() {
  const explicit = process.env.WEBAPP_URL || process.env.MINI_APP_URL;
  if (explicit) {
    return String(explicit).replace(/\/+$/, "");
  }
  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    return `https://${vercel}`;
  }
  return "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Бот работает!");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error("webhook: BOT_TOKEN is not set");
    return res.status(500).send("config error");
  }

  const body = req.body;
  if (!body || !body.message) {
    return res.status(200).send("ok");
  }

  const msg = body.message;
  const chatId = msg.chat.id;
  const text = msg.text;
  const firstName = msg.from && msg.from.first_name;

  if (text !== "/start") {
    return res.status(200).send("ok");
  }

  const miniAppUrl = getMiniAppUrl();
  if (!miniAppUrl) {
    console.error(
      "webhook: задайте WEBAPP_URL (или MINI_APP_URL) в Vercel — иначе кнопка Mini App не откроется"
    );
  }

  const welcomeText =
    "Привет, " +
    (firstName || "друг") +
    "! \uD83D\uDC4B\n\nДобро пожаловать в Золотое Яблоко. У нас ты можешь испытать удачу и выиграть призы!";

  const payload = {
    chat_id: chatId,
    text: welcomeText,
  };

  if (miniAppUrl) {
    payload.reply_markup = {
      inline_keyboard: [
        [
          {
            text: "\uD83C\uDFA1 Испытать удачу",
            web_app: { url: miniAppUrl },
          },
        ],
      ],
    };
  }

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!tgRes.ok) {
      const err = await tgRes.text();
      console.error("webhook: sendMessage failed", err);
    }
  } catch (e) {
    console.error("webhook:", e);
  }

  return res.status(200).send("ok");
}
