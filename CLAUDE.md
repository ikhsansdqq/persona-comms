# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

## Commands

```bash
pnpm dev          # dev server on :3000
pnpm build        # production build
pnpm lint         # ESLint
```

No test runner configured yet.

---

## Architecture

**What it is:** A Telegram bot backed by a single Next.js Route Handler deployed on Vercel. No standalone server. The webhook _is_ the backend.

**Request lifecycle:**
```
Telegram → POST /api/telegram/route.ts
             → lib/telegram/verify.ts   (secret token + chat-ID allowlist)
             → lib/core/router.ts       (orchestrates the pipeline)
                  → lib/intelligence/classify.ts  (text → type via Groq)
                  → lib/intelligence/ocr.ts       (photo → fields via Groq vision)
                  → lib/storage/redis.ts           (Upstash append)
                  → lib/format/reply.ts            (confirmation string)
             ← 200 (always fast; slow work offloaded via waitUntil)
```

**Key constraint:** `route.ts` must stay thin — no classify/store/reply logic inline. All business logic belongs in `lib/`.

**Type contract:** `lib/types.ts` is the single source of truth for every shared type and classifier output shape. All modules import from there; never duplicate shapes.

**Classifier output** — four variants: `todo | task | expense | unknown`. Classification failure always falls back to `unknown` with raw input stored — never drop a capture.

**Idempotency:** Dedupe on `update_id` via a short-TTL Redis key (`seen:{update_id}`) to prevent double-writes on Telegram retries.

**Path alias:** `@/*` maps to `src/*`.

**Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · React Compiler (`reactCompiler: true`) · Groq · Upstash Redis · Vercel

---

## Patterns to avoid

See `PROJECT.md` §6 for the full anti-pattern list. Short version:
- No logic in `route.ts` beyond calling `core/router.ts`
- No module-level mutable state (serverless scope is shared across invocations)
- No `any` — use `unknown` and narrow
- Never block webhook response on slow OCR; use `waitUntil`
- No duplicate type definitions — import from `lib/types.ts`
