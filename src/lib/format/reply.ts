import type { ClassifyResult } from '@/lib/types';

export function buildReply(result: ClassifyResult): string {
  switch (result.type) {
    case 'todo': {
      const d = result.data as { note?: string };
      return `✓ Todo saved: ${d.note ?? ''}`.trim();
    }
    case 'task': {
      const d = result.data as { action?: string; due?: string | null };
      return `✓ Task saved: ${d.action ?? ''}${d.due ? ` (due: ${d.due})` : ''}`.trim();
    }
    case 'expense': {
      const d = result.data as {
        amount?: number | null;
        currency?: string | null;
        merchant?: string | null;
        description?: string;
      };
      const parts: string[] = ['✓ Expense saved'];
      if (d.amount != null) parts.push(`${d.currency ?? ''} ${d.amount}`.trim());
      if (d.merchant) parts.push(`at ${d.merchant}`);
      return parts.join(' ');
    }
    case 'unknown':
      return '✓ Saved as note';
  }
}
