export function verifyWebhook(req: Request): boolean {
  const token = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return token === process.env.TELEGRAM_WEBHOOK_SECRET;
}

export function isAllowedChat(chatId: number): boolean {
  const raw = process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '';
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(String(chatId));
}
