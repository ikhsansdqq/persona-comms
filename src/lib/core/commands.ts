import { getRecordsSince } from '@/lib/storage/d1';
import type { D1Record } from '@/lib/types';

type DateRange = { label: string; since: string };

function dateRange(daysAgo: number): DateRange {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return {
    label: daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `Last ${daysAgo} days`,
    since: d.toISOString().replace('T', ' ').slice(0, 19),
  };
}

function formatRecord(r: D1Record): string {
  const data = JSON.parse(r.data) as Record<string, unknown>;
  const time = r.created_at.slice(11, 16); // HH:MM

  switch (r.type) {
    case 'expense': {
      const amount = data.amount != null ? `${data.currency ?? ''} ${data.amount}`.trim() : '';
      const merchant = data.merchant ? ` @ ${data.merchant}` : '';
      return `💸 [${time}] Expense${amount ? ': ' + amount : ''}${merchant}`;
    }
    case 'todo':
      return `📝 [${time}] Todo: ${data.note ?? r.raw_input ?? ''}`;
    case 'task': {
      const due = data.due ? ` (due ${data.due})` : '';
      return `✅ [${time}] Task: ${data.action ?? r.raw_input ?? ''}${due}`;
    }
    default:
      return `🗒 [${time}] Note: ${r.raw_input ?? ''}`;
  }
}

function summarise(records: D1Record[], label: string): string {
  if (records.length === 0) return `${label}: nothing logged.`;

  const groups: Record<string, D1Record[]> = {};
  for (const r of records) {
    (groups[r.type] ??= []).push(r);
  }

  const lines: string[] = [`📅 *${label}* (${records.length} item${records.length === 1 ? '' : 's'})`, ''];
  for (const [type, items] of Object.entries(groups)) {
    lines.push(`*${type.charAt(0).toUpperCase() + type.slice(1)}s*`);
    lines.push(...items.map(formatRecord));
    lines.push('');
  }
  return lines.join('\n').trim();
}

const COMMANDS: Record<string, number> = {
  '/today': 0,
  '/yesterday': 1,
  '/week': 7,
  '/month': 30,
};

export function isCommand(text: string): boolean {
  return text.startsWith('/') && text.split(' ')[0] in COMMANDS;
}

export async function handleCommand(chatId: number, text: string): Promise<string> {
  const cmd = text.split(' ')[0].toLowerCase();
  const daysAgo = COMMANDS[cmd];
  if (daysAgo === undefined) return 'Unknown command. Try /today, /yesterday, /week, or /month.';

  const { label, since } = dateRange(daysAgo);
  const records = await getRecordsSince(chatId, since);
  return summarise(records, label);
}

export const HELP = `/today — entries logged today
/yesterday — entries from yesterday
/week — last 7 days
/month — last 30 days`;
