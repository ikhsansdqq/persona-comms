# Vercel–Telegram Automation — Engineering Plan & Conventions

**Owner:** ikhsansdq
**Status:** Living document — update in the same commit as any structural change
**Platform:** Vercel (Next.js App Router, Route Handlers) · Telegram Bot API · Groq · Upstash Redis
**Companion doc:** `telegram-automation-standards.md` (architecture & data model)

---

## 1. What We're Building

A single Telegram bot that captures text and photos, classifies each into
`todo | task | expense | unknown` via Groq (vision for receipt OCR), and appends
the result to Upstash Redis — all served by **one Next.js Route Handler** deployed on
Vercel. No standalone server, no new repo, no middleware. The webhook *is* the backend.

---

## 2. The Plan (phased, additive)

Each phase ships independently and never forces a rewrite of the previous one.

| Phase | Deliverable | Done when |
|-------|-------------|-----------|
| 0 | Bot registered, webhook URL set, secret token wired | Bot echoes a received message |
| 1 | Text classification → Redis append + confirmation reply | A typed note is classified & stored |
| 2 | Photo → Groq vision OCR → expense extraction | A receipt photo logs a structured expense |
| 3 | Idempotency + `unknown` fallback + error webhook | Retries don't double-write; failures are visible |
| 4 | Read-only dashboard (Next.js page over Redis) | Monthly totals render from stored data |

**Rule:** do not start a phase until the previous one's "done" condition is met and
committed. This keeps each change small and reviewable.

---

## 3. Project Structure

This lives **inside your existing Vercel/Next.js project**. Only the `api/telegram`
route and the `lib/` modules are new.

```text
your-project/
├── app/
│   ├── page.tsx                       # existing landing page — untouched
│   ├── dashboard/
│   │   └── page.tsx                    # Phase 4: read-only view over Redis
│   └── api/
│       └── telegram/
│           └── route.ts                # THE webhook. Thin orchestrator only.
├── lib/
│   ├── telegram/
│   │   ├── client.ts                   # sendMessage, getFile, downloadFile
│   │   └── verify.ts                   # secret-token + chat-ID allowlist
│   ├── intelligence/
│   │   ├── classify.ts                 # text → {type, data} via Groq
│   │   └── ocr.ts                      # image → text/fields via Groq vision
│   ├── storage/
│   │   └── redis.ts                    # namespaced read/write, range queries
│   ├── format/
│   │   └── reply.ts                    # build confirmation strings
│   ├── core/
│   │   └── router.ts                   # lifecycle: verify→classify→store→reply
│   └── types.ts                        # ALL shared types & the classifier contract
├── .env.local                          # secrets (never committed)
└── README.md                           # this file
```

**Why this shape:**
- `route.ts` stays thin — it calls `core/router.ts` and returns `200`. No business logic.
- Each `lib/` folder has **one responsibility** (Section 4). Swapping Groq for another
  provider touches only `intelligence/`. Swapping Redis touches only `storage/`.
- `types.ts` is the single source of truth — every module imports its contracts from here.

---

## 4. SWE Best Practices

**Layering & boundaries**
- Route handler orchestrates; it never classifies, formats, or talks to Redis directly.
- Transport (`telegram`), intelligence (`classify`/`ocr`), storage (`redis`), and
  formatting (`reply`) are isolated. One concern per module; if a function name needs
  "and", split it.
- Pure functions for classify-parsing, validation, and formatting (no side effects →
  trivially testable). Network/Redis side effects live only in transport/storage.

**TypeScript**
- `strict: true`. No `any` in committed code — use `unknown` and narrow.
- Every record shape and the classifier output are typed in `types.ts`. Those types
  *are* the contract.

**Stateless & idempotent**
- The handler holds no memory between invocations — all state in Redis.
- Telegram retries on timeout: dedupe on `update_id` (short-TTL `seen:{update_id}` key)
  so a receipt never logs twice.

**Fail safe**
- Wrap every external call (Telegram, Groq, Redis) in try/catch.
- On classify/parse failure, store as `unknown` with the raw input — never drop a capture.
- Distinguish user-facing failures (friendly reply) from internal ones (log + store +
  still return `200`).

**The webhook contract**
- Return `200` fast. Verify token → validate → store → reply. Anything slow goes behind
  `waitUntil` so the response isn't blocked.

**Security**
- Check `X-Telegram-Bot-Api-Secret-Token` on every request; reject mismatch with `401`.
- Allowlist your own `chat.id` — drop everything else. A personal bot with no allowlist
  is an open endpoint.
- All secrets via env vars, never hardcoded or committed.

**Commits & docs**
- Small commits scoped to one phase/concern. Update `README.md` and `types.ts` in the
  same commit as the change they describe.

---

## 5. Token-Usage Optimization

Two distinct token budgets to protect: **Groq inference tokens** (runtime cost) and
**agent/codebase tokens** (your AI coding sessions). Both matter.

### 5a. Groq inference (runtime)
- **Route by input type before calling the model.** Plain text → cheap text model.
  Only call vision when an actual photo is attached. Never run OCR speculatively.
- **Cap input size.** Truncate over-long messages and reject oversized images *before*
  the API call — don't pay tokens to fail.
- **Tight system prompts.** The classifier prompt should be short and fixed: enumerate
  the four types, demand JSON-only output, no examples bloat unless accuracy needs them.
- **Constrain output.** Ask for compact JSON, no prose. Smaller responses = fewer tokens.
- **Smallest model that holds accuracy.** Don't default to the largest Groq model for a
  4-way classification.

### 5b. Codebase/agent tokens — avoid re-searching the same code
This is the expensive, repeated cost in AI-assisted development. The structure above is
designed to minimize it:

- **`types.ts` as the index.** When working with an agent, point it at `types.ts` first.
  One file describes every contract, so the agent rarely needs to scan multiple modules
  to learn the data shapes.
- **One responsibility per file = targeted reads.** Because `classify.ts` only classifies
  and `redis.ts` only stores, a task touching storage needs to load *one* small file, not
  grep the whole repo. Predictable file names mean the agent reads the right file the
  first time instead of searching.
- **Keep `README.md` current as the map.** A correct structure section here lets an agent
  locate the right file from the doc without scanning the tree — the cheapest possible
  "search."
- **Stable file paths & naming.** Don't move/rename modules casually; cached agent context
  goes stale and forces re-reads. Additive changes over restructuring (your standing
  preference) directly reduces re-scan cost.
- **Small files.** A 60-line focused module costs far fewer tokens to load than a
  500-line catch-all. The module boundaries enforce this naturally.
- **Co-locate the contract with its consumers.** Because every module imports types from
  one place, an agent doesn't reconstruct shapes by reading call sites across the repo.

**Rule of thumb:** if an agent has to read more than one or two files to make a scoped
change, the structure is too entangled — refactor toward the boundaries in Section 3.

---

## 6. Code Patterns to AVOID

**Architecture**
- ❌ Putting classify + OCR + store + reply inline in `route.ts`. (Fat handler, untestable,
  forces full-file reads.)
- ❌ Adding Express/Fastify/Hono or any extra server. The Route Handler is the server on
  Vercel; a second framework fights the serverless model.
- ❌ Adding Next.js `middleware.ts` for webhook auth. Secret-token checks belong *inside*
  the route handler, not in edge middleware.
- ❌ Reaching for Postgres/Supabase/Neon/an ORM. Redis append-only is the deliberate
  ceiling for this personal-scale time-series. Don't add relational infra without a
  concrete need.

**State & correctness**
- ❌ Module-level mutable state holding per-request data (breaks on serverless/edge where
  scope is shared across invocations). Keep state in Redis.
- ❌ Ignoring `update_id` → double-logged expenses on Telegram retries.
- ❌ Blocking the webhook response on slow OCR/classify work. Offload via `waitUntil`.

**Error handling**
- ❌ Swallowing errors silently (`catch {}`). Log with context.
- ❌ Dropping a capture when classification fails. Always fall back to `unknown`.
- ❌ Letting a malformed Groq JSON response crash the handler. Parse defensively in
  try/catch and validate against the enum.

**Types & quality**
- ❌ `any`, or untyped `JSON.parse` results flowing through the system.
- ❌ Duplicating record-shape definitions across files instead of importing from `types.ts`.
- ❌ Hardcoded secrets, tokens, or chat IDs.

**Token/structure smells**
- ❌ 500-line catch-all files that force full reads for any change.
- ❌ Casual renames/moves that invalidate agent context and trigger re-scans.
- ❌ Vague file names (`utils.ts`, `helpers.ts`) that hide what's inside and force a read
  to find out. Name by responsibility.

---

## 7. Definition of Done (every change)

- [ ] Scoped to a single phase/concern; small commit
- [ ] Types updated in `types.ts` for any new shape or contract field
- [ ] External calls wrapped in try/catch with `unknown` fallback
- [ ] Secret-token + chat-ID checks intact
- [ ] Idempotency preserved (no double-writes on retry)
- [ ] Webhook still returns `200` fast (slow work offloaded)
- [ ] Confirmation reply reflects new behavior
- [ ] `README.md` updated in the same commit

---

## Development & Setup

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. You can start editing the page by modifying `app/page.tsx`.

### Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) - easiest way to deploy your Next.js app.
