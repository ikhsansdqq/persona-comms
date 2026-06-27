import type { TelegramUpdate, ClassifyResult, D1Record } from '@/lib/types';

const d1Url = () =>
  `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`;

interface D1Response {
  result: Array<{ results: unknown[] }>;
  success: boolean;
  errors: Array<{ message: string }>;
}

async function d1Query(sql: string, params: unknown[] = []): Promise<unknown[]> {
  const res = await fetch(d1Url(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });
  const json = (await res.json()) as D1Response;
  if (!json.success) throw new Error(json.errors[0]?.message ?? 'D1 query failed');
  return json.result[0]?.results ?? [];
}

export async function appendRecord(
  update: TelegramUpdate,
  result: ClassifyResult,
): Promise<void> {
  const chatId = update.message?.chat.id;
  const rawInput = update.message?.text ?? update.message?.caption ?? null;
  await d1Query(
    `INSERT OR IGNORE INTO records (update_id, chat_id, type, data, raw_input)
     VALUES (?, ?, ?, ?, ?)`,
    [update.update_id, chatId, result.type, JSON.stringify(result.data), rawInput],
  );
}

export async function getRecords(chatId: number, type?: string): Promise<D1Record[]> {
  if (type) {
    return d1Query(
      `SELECT * FROM records WHERE chat_id = ? AND type = ? ORDER BY created_at DESC`,
      [chatId, type],
    ) as Promise<D1Record[]>;
  }
  return d1Query(
    `SELECT * FROM records WHERE chat_id = ? ORDER BY created_at DESC`,
    [chatId],
  ) as Promise<D1Record[]>;
}

export async function getMonthlyExpenses(
  chatId: number,
): Promise<Array<{ month: string; total: number; count: number }>> {
  return d1Query(
    `SELECT strftime('%Y-%m', created_at) as month,
            COUNT(*) as count,
            SUM(CAST(json_extract(data, '$.amount') AS REAL)) as total
     FROM records
     WHERE chat_id = ? AND type = 'expense'
     GROUP BY month
     ORDER BY month DESC`,
    [chatId],
  ) as Promise<Array<{ month: string; total: number; count: number }>>;
}
