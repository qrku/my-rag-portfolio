create table if not exists public.source_documents (
  lang text not null check (lang in ('ru', 'en')),
  name text not null,
  content text not null,
  updated_at timestamptz not null default now(),
  primary key (lang, name)
);

alter table public.source_documents enable row level security;
