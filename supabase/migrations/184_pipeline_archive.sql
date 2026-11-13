-- Archive of documents exported from Pipeline (signed contracts, invoices, proposals),
-- attached to the matching project so they live in the Hub after Pipeline is gone.

insert into storage.buckets (id, name, public, file_size_limit)
values ('pipeline-archive', 'pipeline-archive', false, 15728640)
on conflict (id) do nothing;

create table if not exists public.pipeline_archive_documents (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.pipeline_projects (id) on delete cascade,
  kind          text not null default 'other'
                  check (kind in ('contract', 'invoice', 'proposal', 'other')),
  file_name     text not null,
  storage_path  text not null unique,
  size_bytes    bigint not null default 0,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists pipeline_archive_documents_project_idx
  on public.pipeline_archive_documents (project_id, created_at desc);

alter table public.pipeline_archive_documents enable row level security;

drop policy if exists "hb archive read staff" on public.pipeline_archive_documents;
create policy "hb archive read staff" on public.pipeline_archive_documents for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));
drop policy if exists "hb archive write admin lead" on public.pipeline_archive_documents;
create policy "hb archive write admin lead" on public.pipeline_archive_documents for all to authenticated
  using (public.current_user_role() in ('admin', 'trainer'))
  with check (public.current_user_role() in ('admin', 'trainer'));

grant select, insert, update, delete on public.pipeline_archive_documents to authenticated, service_role;
