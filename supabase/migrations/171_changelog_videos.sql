-- 171_changelog_videos.sql
-- Change Log Videos: a short "What's New" video for each month of the Changelog,
-- shown right above that month's entries, plus a weekly check log.
--
-- Visibility is enforced here (row level security), not just in the page:
--   * admins see everything, including superseded (hidden) videos
--   * everyone else sees only live videos from the 60 days before their
--     profile start date onward (no start date on file = all live videos)
--   * videos with audience 'vident-av' are limited to admins and the
--     Audiovisual department, the same people who can open Vident AV;
--     audience 'lead' is limited to admins and Leads (role trainer)
-- A newer video of the same kind and audience that fully covers an older
-- one's topics hides the older one automatically (status = 'superseded',
-- kept for admins).

create table if not exists public.changelog_videos (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  kind          text not null default 'roundup'
                  check (kind in ('roundup', 'feature')),
  audience      text not null default 'all'
                  check (audience in ('all', 'lead', 'vident-av')),
  period_start  date not null,
  period_end    date not null,
  src           text not null,
  topic_keys    text[] not null default '{}',
  summary       text not null default '',
  status        text not null default 'live'
                  check (status in ('live', 'superseded')),
  superseded_by uuid references public.changelog_videos(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint changelog_videos_title_not_blank check (char_length(trim(title)) > 0),
  constraint changelog_videos_period_order check (period_end >= period_start),
  constraint changelog_videos_src_https check (src like 'https://%'),
  constraint changelog_videos_src_unique unique (src)
);

comment on table public.changelog_videos is
  'Monthly and per-feature Changelog videos. topic_keys are page routes or feature slugs the video covers; a newer same-kind, same-audience video covering all of an older one''s topics supersedes it.';

create index if not exists changelog_videos_period_idx
  on public.changelog_videos (period_end desc, created_at desc);

-- The signed-in person's profile start date, readable inside the policy below
-- without depending on profile row visibility.
create or replace function public.my_start_date()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select start_date from public.profiles where id = auth.uid()
$$;

-- Can the signed-in person open Vident AV? (admin or Audiovisual department)
create or replace function public.my_av_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role::text = 'admin' or 'Audiovisual' = any (departments::text[])
       from public.profiles where id = auth.uid()),
    false
  )
$$;

-- Is the signed-in person an admin or a Lead (internal role key: trainer)?
create or replace function public.my_lead_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role::text in ('admin', 'trainer')
       from public.profiles where id = auth.uid()),
    false
  )
$$;

grant execute on function public.my_start_date() to authenticated;
grant execute on function public.my_lead_access() to authenticated;
grant execute on function public.my_av_access() to authenticated;

alter table public.changelog_videos enable row level security;

drop policy if exists "changelog_videos read" on public.changelog_videos;
create policy "changelog_videos read" on public.changelog_videos
  for select to authenticated
  using (
    public.is_admin()
    or (
      status = 'live'
      and period_end >= coalesce(public.my_start_date(), date '1900-01-01') - 60
      and (
        audience = 'all'
        or (audience = 'lead' and public.my_lead_access())
        or (audience = 'vident-av' and public.my_av_access())
      )
    )
  );

drop policy if exists "changelog_videos admin insert" on public.changelog_videos;
create policy "changelog_videos admin insert" on public.changelog_videos
  for insert to authenticated with check (public.is_admin());

drop policy if exists "changelog_videos admin update" on public.changelog_videos;
create policy "changelog_videos admin update" on public.changelog_videos
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "changelog_videos admin delete" on public.changelog_videos;
create policy "changelog_videos admin delete" on public.changelog_videos
  for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.changelog_videos to authenticated;

-- A new live video hides older live videos of the same kind and audience whose
-- topics it fully covers. Partial overlaps are left alone (the weekly check
-- flags them for an admin to decide).
create or replace function public.changelog_video_supersede()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'live' and coalesce(array_length(new.topic_keys, 1), 0) > 0 then
    update public.changelog_videos o
       set status = 'superseded',
           superseded_by = new.id
     where o.id <> new.id
       and o.status = 'live'
       and o.kind = new.kind
       and o.audience = new.audience
       and o.created_at <= new.created_at
       and coalesce(array_length(o.topic_keys, 1), 0) > 0
       and o.topic_keys <@ new.topic_keys;
  end if;
  return null;
end;
$$;

drop trigger if exists changelog_video_supersede_trg on public.changelog_videos;
create trigger changelog_video_supersede_trg
  after insert on public.changelog_videos
  for each row execute function public.changelog_video_supersede();

-- Weekly check log: one row per check, including weeks with no changes.
create table if not exists public.changelog_video_runs (
  id             uuid primary key default gen_random_uuid(),
  check_date     date not null default current_date,
  since_date     date,
  entries_found  integer not null default 0,
  entry_titles   text[] not null default '{}',
  status         text not null default 'no_changes'
                   check (status in ('no_changes', 'video_owed', 'video_published')),
  note           text not null default '',
  created_at     timestamptz not null default now(),
  constraint changelog_video_runs_date_unique unique (check_date)
);

comment on table public.changelog_video_runs is
  'Weekly Changelog video check log (admin only): what was found since the last check and whether a video is owed or published. The Vident changelog lives in src/lib/changelog.ts, so entries are counted from that file.';

alter table public.changelog_video_runs enable row level security;

drop policy if exists "changelog_video_runs admin read" on public.changelog_video_runs;
create policy "changelog_video_runs admin read" on public.changelog_video_runs
  for select to authenticated using (public.is_admin());

drop policy if exists "changelog_video_runs admin insert" on public.changelog_video_runs;
create policy "changelog_video_runs admin insert" on public.changelog_video_runs
  for insert to authenticated with check (public.is_admin());

drop policy if exists "changelog_video_runs admin update" on public.changelog_video_runs;
create policy "changelog_video_runs admin update" on public.changelog_video_runs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.changelog_video_runs to authenticated;

-- First check: covers everything logged so far (Aug 11 - Nov 5, 2026).
insert into public.changelog_video_runs (check_date, since_date, entries_found, status, note)
values (
  date '2026-11-05', date '2026-08-11', 104, 'video_owed',
  'Backlog check: monthly What''s New videos for Aug-Nov 2026 and a Vident AV video are owed.'
)
on conflict (check_date) do nothing;
