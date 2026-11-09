-- Ask the Hub knowledge base: documents, embedded chunks, and the vector
-- search RPC used by /api/ask. These objects existed only in the source
-- project's database; this migration recreates them for the Vident project.
--
-- The app reads/writes with the signed-in user's client, so RLS gates
-- writes to admins (public.is_admin()) and reads to non-guest staff.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Documents (hub guides, resources, custom articles, uploads)
-- ---------------------------------------------------------------------------

create table if not exists public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null default 'article',
  source_id text,
  content text not null,
  created_at timestamptz not null default now()
);

comment on table public.kb_documents is
  'Ask the Hub knowledge base documents (hub guides, resources, custom articles).';

alter table public.kb_documents enable row level security;

drop policy if exists "Staff read kb documents" on public.kb_documents;
create policy "Staff read kb documents"
  on public.kb_documents
  for select
  to authenticated
  using (public.current_user_role() is distinct from 'guest');

drop policy if exists "Admins insert kb documents" on public.kb_documents;
create policy "Admins insert kb documents"
  on public.kb_documents
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins update kb documents" on public.kb_documents;
create policy "Admins update kb documents"
  on public.kb_documents
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete kb documents" on public.kb_documents;
create policy "Admins delete kb documents"
  on public.kb_documents
  for delete
  to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.kb_documents to authenticated;

-- ---------------------------------------------------------------------------
-- Chunks (embedded ~1500-char slices of each document)
-- ---------------------------------------------------------------------------

create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kb_documents (id) on delete cascade,
  content text not null,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

comment on table public.kb_chunks is
  'Embedded chunks for Ask the Hub semantic search (text-embedding-3-small, 1536 dims).';

create index if not exists kb_chunks_document_id_idx
  on public.kb_chunks (document_id);

create index if not exists kb_chunks_embedding_idx
  on public.kb_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.kb_chunks enable row level security;

drop policy if exists "Staff read kb chunks" on public.kb_chunks;
create policy "Staff read kb chunks"
  on public.kb_chunks
  for select
  to authenticated
  using (public.current_user_role() is distinct from 'guest');

drop policy if exists "Admins insert kb chunks" on public.kb_chunks;
create policy "Admins insert kb chunks"
  on public.kb_chunks
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins update kb chunks" on public.kb_chunks;
create policy "Admins update kb chunks"
  on public.kb_chunks
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete kb chunks" on public.kb_chunks;
create policy "Admins delete kb chunks"
  on public.kb_chunks
  for delete
  to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.kb_chunks to authenticated;

-- ---------------------------------------------------------------------------
-- Vector search RPC (security invoker: RLS applies to the caller)
-- ---------------------------------------------------------------------------

create or replace function public.match_kb_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 6,
  similarity_threshold double precision default 0.3
)
returns table (content text, title text, similarity double precision)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.content,
    d.title,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.kb_chunks c
  join public.kb_documents d on d.id = c.document_id
  where c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_kb_chunks(extensions.vector, int, double precision)
  to authenticated;
