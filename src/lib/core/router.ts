import type { TelegramUpdate } from '@/lib/types';
import { isAllowedChat } from '@/lib/telegram/verify';
import { sendMessage, getFile, downloadFile } from '@/lib/telegram/client';
import { classifyText } from '@/lib/intelligence/classify';
import { extractExpense } from '@/lib/intelligence/ocr';
import { appendRecord } from '@/lib/storage/d1';
import { buildReply } from '@/lib/format/reply';

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  if (!isAllowedChat(chatId)) return;

  try {
    if (message.photo && message.photo.length > 0) {
      // Largest photo is the last element in the array
      const photo = message.photo[message.photo.length - 1];
      const filePath = await getFile(photo.file_id);
      const fileBytes = await downloadFile(filePath);
      const result = await extractExpense(fileBytes);
      await appendRecord(update, result);
      await sendMessage(chatId, buildReply(result));
      return;
    }

    const text = message.text ?? message.caption;
    if (text) {
      const result = await classifyText(text);
      await appendRecord(update, result);
      await sendMessage(chatId, buildReply(result));
    }
  } catch (err) {
    console.error('[router] unhandled error for update_id', update.update_id, err);
    try {
      await sendMessage(chatId, '⚠️ Something went wrong. Your message was logged.');
    } catch {
      // swallow — we already logged above
    }
  }
}
