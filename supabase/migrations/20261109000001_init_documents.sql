create extension if not exists vector with schema extensions;

create table if not exists public.documents (
  id bigint generated always as identity primary key,
  lang text not null check (lang in ('ru', 'en')),
  source text not null,
  chunk_index int not null,
  content text not null,
  embedding extensions.vector(1536) not null,
  unique (lang, source, chunk_index)
);

alter table public.documents enable row level security;

create index if not exists documents_embedding_idx
  on public.documents
  using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.match_documents(
  query_embedding extensions.vector(1536),
  match_lang text,
  match_count int default 5
)
returns table (
  id bigint,
  source text,
  content text,
  similarity float
)
language sql stable
set search_path = public, extensions
as $$
  select
    d.id,
    d.source,
    d.content,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where d.lang = match_lang
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_documents from public, anon, authenticated;
grant execute on function public.match_documents to service_role;
