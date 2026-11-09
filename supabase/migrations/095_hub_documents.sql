-- Hub Documents: publishable agreements (content + draft) and e-sign acknowledgements.
-- Mirrors Staff Handbook draft/publish: drafts are admin-only; published rows are staff-readable.

-- ---------------------------------------------------------------------------
-- Document content (one row per agreement key)
-- ---------------------------------------------------------------------------

create table if not exists public.hub_documents (
  key text primary key,
  title text not null,
  is_draft boolean not null default true,
  content jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on table public.hub_documents is
  'Hub Documents agreements. Draft rows are admin-only; published content is readable by signed-in staff.';

alter table public.hub_documents enable row level security;

drop policy if exists "Read hub documents when published or admin"
  on public.hub_documents;
create policy "Read hub documents when published or admin"
  on public.hub_documents
  for select
  to authenticated
  using (
    public.current_user_role() is distinct from 'guest'
    and (not is_draft or public.is_admin())
  );

drop policy if exists "Admins insert hub documents" on public.hub_documents;
create policy "Admins insert hub documents"
  on public.hub_documents
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins update hub documents" on public.hub_documents;
create policy "Admins update hub documents"
  on public.hub_documents
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete hub documents" on public.hub_documents;
create policy "Admins delete hub documents"
  on public.hub_documents
  for delete
  to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.hub_documents to authenticated;

-- ---------------------------------------------------------------------------
-- Acknowledgements / digital signatures
-- ---------------------------------------------------------------------------

create table if not exists public.hub_document_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_key text not null,
  document_revision text not null default 'draft',
  signer_name text not null,
  signer_email text not null default '',
  signature_data text not null,
  ip_address text,
  user_agent text,
  signed_at timestamptz not null default now(),
  unique (user_id, document_key, document_revision)
);

comment on table public.hub_document_acknowledgements is
  'Staff digital signatures for Hub Documents (keyed by document + draft/live revision).';

create index if not exists hub_document_acknowledgements_user_idx
  on public.hub_document_acknowledgements (user_id);

create index if not exists hub_document_acknowledgements_doc_idx
  on public.hub_document_acknowledgements (document_key, document_revision);

create index if not exists hub_document_acknowledgements_signed_idx
  on public.hub_document_acknowledgements (signed_at desc);

alter table public.hub_document_acknowledgements enable row level security;

drop policy if exists "Users read own or elevated document acks"
  on public.hub_document_acknowledgements;
create policy "Users read own or elevated document acks"
  on public.hub_document_acknowledgements
  for select
  to authenticated
  using (
    public.current_user_role() is distinct from 'guest'
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('admin', 'trainer')
    )
  );

drop policy if exists "Users insert own document acks"
  on public.hub_document_acknowledgements;
create policy "Users insert own document acks"
  on public.hub_document_acknowledgements
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_user_role() is distinct from 'guest'
  );

drop policy if exists "Users update own document acks"
  on public.hub_document_acknowledgements;
create policy "Users update own document acks"
  on public.hub_document_acknowledgements
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_user_role() is distinct from 'guest'
  )
  with check (
    user_id = auth.uid()
    and public.current_user_role() is distinct from 'guest'
  );

grant select, insert, update on public.hub_document_acknowledgements to authenticated;
