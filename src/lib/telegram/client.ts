const BASE = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(chatId: number, text: string): Promise<void> {
  await fetch(`${BASE()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function getFile(fileId: string): Promise<string> {
  const res = await fetch(`${BASE()}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const json = (await res.json()) as { result: { file_path: string } };
  return json.result.file_path;
}

export async function downloadFile(filePath: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`,
  );
  return res.arrayBuffer();
}
