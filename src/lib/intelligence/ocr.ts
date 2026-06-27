import Groq from 'groq-sdk';
import type { ClassifyResult, ClassifyType } from '@/lib/types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Update model name if Groq adds newer vision models
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const SYSTEM = `Extract expense details from this receipt image.
Return compact JSON only — no prose, no markdown:
{"type":"expense","data":{"amount":<number or null>,"currency":"<ISO or null>","merchant":"<string or null>","date":"<YYYY-MM-DD or null>","raw":"<extracted text>"}}
If not a receipt, return: {"type":"unknown","data":{"raw":"not a receipt"}}`;

const VALID_TYPES = new Set<ClassifyType>(['expense', 'unknown']);

export async function extractExpense(imageBytes: ArrayBuffer): Promise<ClassifyResult> {
  try {
    const base64 = Buffer.from(imageBytes).toString('base64');
    const completion = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0,
    });
    const raw = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as { type: string; data: unknown };
    if (!VALID_TYPES.has(parsed.type as ClassifyType)) throw new Error('invalid type');
    return { type: parsed.type as ClassifyType, data: parsed.data };
  } catch {
    return { type: 'unknown', data: { raw: 'ocr failed' } };
  }
}
