import { after } from 'next/server';
import type { TelegramUpdate } from '@/lib/types';
import { verifyWebhook } from '@/lib/telegram/verify';
import { handleUpdate } from '@/lib/core/router';

export async function POST(req: Request): Promise<Response> {
  if (!verifyWebhook(req)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  after(async () => {
    await handleUpdate(update);
  });

  return Response.json({ ok: true });
}
