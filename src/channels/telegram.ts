import { config } from "../config.js";

export async function sendTelegram(message: string): Promise<void> {
  if (!config.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");
  if (!config.TELEGRAM_CHAT_IDS.length) throw new Error("TELEGRAM_CHAT_IDS not set");

  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;

  await Promise.all(
    config.TELEGRAM_CHAT_IDS.map(async (chatId) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Telegram API error (${res.status}): ${err}`);
      }
    })
  );
}
