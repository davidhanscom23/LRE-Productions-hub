-- Gear checklist history archive (Phase 5).
-- Each year on Dec 31 (cron), every check not yet archived is zipped (spreadsheet + photos) and
-- uploaded to the "Vident Hub Backup" shared drive. Once a check is archived and older than the
-- 90-day live window, its photo is removed from Hub storage. The check rows themselves stay
-- (they feed the progress counts and the permanent per-item last-used trace).

alter table public.event_checklist_checks
  add column if not exists archived_at timestamptz,
  add column if not exists archive_id uuid,
  add column if not exists photo_archived_path text;

create index if not exists event_checklist_checks_unarchived_idx
  on public.event_checklist_checks (checked_at)
  where archived_at is null;

create index if not exists event_checklist_checks_photo_purge_idx
  on public.event_checklist_checks (checked_at)
  where archived_at is not null and photo_path is not null;

create table if not exists public.event_checklist_archives (
  id               uuid primary key default gen_random_uuid(),
  file_name        text not null,
  drive_file_id    text not null,
  drive_folder_id  text not null,
  row_count        integer not null default 0,
  photo_count      integer not null default 0,
  bytes            bigint not null default 0,
  first_checked_at timestamptz,
  last_checked_at  timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.event_checklist_archives enable row level security;

drop policy if exists "checklist archives admin read" on public.event_checklist_archives;
create policy "checklist archives admin read" on public.event_checklist_archives
  for select to authenticated
  using (public.current_user_role()::text = 'admin');

grant select on public.event_checklist_archives to authenticated;
grant select, insert, update, delete on public.event_checklist_archives to service_role;

comment on table public.event_checklist_archives is
  'One row per zip uploaded to the Vident Hub Backup shared drive by the yearly checklist archive.';
