# Project context (for AI agents)

Personal portfolio site with a RAG chat that answers questions about the owner's experience.
Owner's language is Russian; the site and chat support **ru** and **en**. Read `AGENTS.md` first:
this is a new Next.js version, check `node_modules/next/dist/docs/` before writing Next code
(e.g. `middleware` is now `proxy`, `cookies()` is async). Same for the AI SDK:
`node_modules/ai/docs/` (`ai` v7, streaming uses `createUIMessageStreamResponse` + `toUIMessageStream`).

## Stack
- Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind 4. Deploy: Vercel Hobby (free).
- Vector DB: Supabase Postgres + pgvector (HNSW, cosine, 1536 dims).
- LLM and embeddings: **OpenRouter only** (no OpenAI key), via `@ai-sdk/openai` with a custom `baseURL`.
  Defaults: chat `openai/gpt-4o-mini`, embeddings `openai/text-embedding-3-small`.
- Supabase uses the **new keys**: `SUPABASE_SECRET_KEY` (`sb_secret_...`), not legacy `service_role`.
  Never use the publishable key for server writes: RLS is enabled with no policies, so only the secret key can access tables.

## Layout
- `src/lib/ai.ts` OpenRouter provider, chat and embedding models.
- `src/lib/supabase.ts` server-only Supabase client (secret key).
- `src/lib/rag.ts` chunking (by Markdown headings, max ~1000 chars), `indexDocument`, `removeIndexedDocument`, `hashContent`.
- `src/lib/admin-auth.ts` password auth for /admin: HMAC-signed httpOnly cookie, 8h TTL.
- `src/app/api/chat/route.ts` embed question, `match_documents` RPC (filtered by `lang`), stream answer. Limits: 500 chars/question, 10 messages history, 600 output tokens.
- `src/app/page.tsx` temporary test chat UI with RU/EN switch (history clears on switch).
- `src/app/admin/page.tsx` + `src/app/api/admin/*` document management (see below).
- `src/instrumentation.ts` dev only: disables Node `autoSelectFamily` (see Gotchas).
- `supabase/migrations/` ordered SQL migrations. `scripts/` CLI scripts.

## Data model
- `source_documents (lang, name, content, updated_at, indexed_hash, indexed_at)`: raw Markdown files, source of truth.
- `documents (lang, source, chunk_index, content, embedding)`: chunks for search. `source` = file name.
- Index status is derived: `indexed` (chunks exist and hash matches), `stale` (file changed after indexing),
  `not_indexed`, `index_only` (chunks without a file).

## Admin (/admin)
Documents are NOT stored in git (`/content/` is gitignored). They live in Supabase and are managed at `/admin`:
save without indexing, save and index, index/reindex, remove index only (keep file), delete file + index, reindex all.
All `/api/admin/*` routes must check `isAuthenticated()`. Login needs `ADMIN_PASSWORD`; if unset, admin is disabled.

## Commands
- `npm run dev` / `build` / `lint`; `npx tsc --noEmit`.
- `npm run db:migrate` applies pending files from `supabase/migrations/` (tracked in `public.schema_migrations`,
  each in a transaction). Needs `SUPABASE_DB_URL`. Migrations are idempotent for the first three.
- `npm run ingest` one-off import of local `content/{ru,en}/*.md` into Supabase and indexing.

## Env vars (`.env.local`, see `.env.example`; never commit or print values)
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OPENROUTER_API_KEY`, `ADMIN_PASSWORD`,
optional `ADMIN_SESSION_SECRET`, `OPENROUTER_CHAT_MODEL`, `OPENROUTER_EMBEDDING_MODEL`, `SUPABASE_DB_URL` (migrations only).
Set the runtime ones on Vercel too.

## Rules
- Schema changes: add a new numbered file in `supabase/migrations/`; never edit applied ones.
- Keep secrets server-side; do not read or echo `.env.local` values.
- The owner may already have `next dev` running (port 3001): do not kill it; test on another port with `next start`.

## Gotchas
- On the owner's network Node 26 `fetch` intermittently hangs (`UND_ERR_CONNECT_TIMEOUT`) due to happy-eyeballs.
  Fixed locally with `setDefaultAutoSelectFamily(false)` in scripts and `instrumentation.ts`. Not needed on Vercel.
- Supabase REST cannot run DDL; migrations go through direct Postgres (`pg`), use the Session pooler URL (direct host is IPv6-only).

## Status / TODO
Done: RAG backend, test chat UI, admin with indexing management, migrations.
Todo: rate limiting on `/api/chat` and `/api/admin/login` (e.g. Upstash), real portfolio pages with i18n
(`proxy.ts` + `app/[lang]`), deploy to Vercel with env vars.
