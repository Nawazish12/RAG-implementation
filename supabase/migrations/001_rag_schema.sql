-- Run this in Supabase SQL Editor (Dashboard → SQL) or via Supabase CLI migrations.
-- Requires pgvector (enabled by default on Supabase).

create extension if not exists vector;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  filename text,
  mime_type text,
  byte_size int,
  created_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id bigserial primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536),
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);

-- Cosine similarity search (pgvector <-> operator = cosine distance when using vector_cosine_ops)
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Match chunks closest to the query embedding (cosine distance)
create or replace function public.match_document_chunks (
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  id bigint,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    (1 - (dc.embedding <=> query_embedding))::float as similarity
  from public.document_chunks dc
  where dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit greatest(1, least(match_count, 32));
$$;

-- Practice project: no RLS. Use the service role key only on the server (Next.js API routes).

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant execute on function public.match_document_chunks to postgres, service_role;
