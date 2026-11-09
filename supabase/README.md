# Supabase migrations

Run the files in `migrations/` in order in the Supabase SQL Editor (each file once).
Add every new schema change as a new file with the next number, never edit applied ones.

| File | What it does |
| --- | --- |
| `20261109000001_init_documents.sql` | pgvector, `documents` table (chunks + embeddings), `match_documents` search function |
| `20261109000002_source_documents.sql` | `source_documents` table (raw Markdown files managed in /admin) |
| `20261109000003_index_tracking.sql` | `indexed_hash` / `indexed_at` columns, `document_chunk_counts()` function |
