alter table public.source_documents
  add column if not exists indexed_hash text,
  add column if not exists indexed_at timestamptz;

create or replace function public.document_chunk_counts()
returns table (lang text, source text, chunks bigint)
language sql stable
set search_path = public
as $$
  select d.lang, d.source, count(*) from public.documents d group by d.lang, d.source;
$$;

revoke all on function public.document_chunk_counts from public, anon, authenticated;
grant execute on function public.document_chunk_counts to service_role;
