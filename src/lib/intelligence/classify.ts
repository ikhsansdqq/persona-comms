import Groq from 'groq-sdk';
import type { ClassifyResult, ClassifyType } from '@/lib/types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM = `Classify the user message into exactly one type: todo, task, expense, or unknown.
Return compact JSON only — no prose, no markdown:
{"type":"<type>","data":<object>}

Types:
- todo: something to remember or buy. data: {"note":"<string>"}
- task: an action to complete. data: {"action":"<string>","due":"<YYYY-MM-DD or null>"}
- expense: money spent. data: {"amount":<number or null>,"currency":"<ISO or null>","merchant":"<string or null>","description":"<string>"}
- unknown: anything else. data: {"raw":"<string>"}`;

const VALID_TYPES = new Set<ClassifyType>(['todo', 'task', 'expense', 'unknown']);

export async function classifyText(text: string): Promise<ClassifyResult> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text.slice(0, 2000) },
      ],
      max_tokens: 200,
      temperature: 0,
    });
    const raw = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as { type: string; data: unknown };
    if (!VALID_TYPES.has(parsed.type as ClassifyType)) throw new Error('invalid type');
    return { type: parsed.type as ClassifyType, data: parsed.data };
  } catch {
    return { type: 'unknown', data: { raw: text } };
  }
}
