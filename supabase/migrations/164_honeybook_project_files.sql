-- Client file requests for shared Hub CRM projects (/project/[token]).
-- Access: service role for public uploads; authenticated staff read/delete via app.

insert into storage.buckets (id, name, public, file_size_limit)
values ('honeybook-project-files', 'honeybook-project-files', false, 52428800)
on conflict (id) do nothing;

create table if not exists public.honeybook_project_files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.honeybook_projects (id) on delete cascade,
  item_key      text not null default 'other',
  storage_path  text not null,
  file_name     text not null default '',
  mime_type     text not null default '',
  size_bytes    integer not null default 0,
  uploaded_at   timestamptz not null default now(),
  constraint honeybook_project_files_path_not_blank check (char_length(trim(storage_path)) > 0)
);

create index if not exists honeybook_project_files_project_idx
  on public.honeybook_project_files (project_id, uploaded_at desc);

create unique index if not exists honeybook_project_files_path_uidx
  on public.honeybook_project_files (storage_path);

comment on table public.honeybook_project_files is
  'Client (or staff) uploads for a Hub CRM project share link.';

alter table public.honeybook_project_files enable row level security;

-- Staff who can open HoneyBook may read file metadata
drop policy if exists "honeybook_project_files select hb" on public.honeybook_project_files;
create policy "honeybook_project_files select hb"
  on public.honeybook_project_files for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));

-- Admins / Leads manage files from Hub
drop policy if exists "honeybook_project_files admin all" on public.honeybook_project_files;
create policy "honeybook_project_files admin all"
  on public.honeybook_project_files for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "honeybook_project_files trainer write" on public.honeybook_project_files;
create policy "honeybook_project_files trainer write"
  on public.honeybook_project_files for all to authenticated
  using (public.current_user_role() = 'trainer')
  with check (public.current_user_role() = 'trainer');

-- Assignees may delete files on their projects
drop policy if exists "honeybook_project_files assignee delete" on public.honeybook_project_files;
create policy "honeybook_project_files assignee delete"
  on public.honeybook_project_files for delete to authenticated
  using (
    public.current_user_role() = 'staff'
    and exists (
      select 1 from public.honeybook_project_assignees a
      where a.project_id = honeybook_project_files.project_id
        and a.profile_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.honeybook_project_files to authenticated;
grant select, insert, update, delete on public.honeybook_project_files to service_role;
