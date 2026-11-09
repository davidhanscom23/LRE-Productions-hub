-- Track Drive files indexed into Ask the Hub for incremental sync.

create table if not exists public.kb_drive_file_state (
  file_id         text primary key,
  name            text not null default '',
  mime_type       text not null default '',
  modified_time   text not null default '',
  content_sha     text not null default '',
  document_id     uuid references public.kb_documents(id) on delete set null,
  skip_reason     text not null default '',
  last_synced_at  timestamptz not null default now()
);

create index if not exists kb_drive_file_state_synced_idx
  on public.kb_drive_file_state (last_synced_at desc);

alter table public.kb_drive_file_state enable row level security;

drop policy if exists "kb drive state admin all" on public.kb_drive_file_state;
create policy "kb drive state admin all"
  on public.kb_drive_file_state for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.kb_drive_file_state to authenticated;
grant select, insert, update, delete on public.kb_drive_file_state to service_role;

comment on table public.kb_drive_file_state is
  'Incremental sync state for Drive → Ask the Hub indexing (source_type drive).';
