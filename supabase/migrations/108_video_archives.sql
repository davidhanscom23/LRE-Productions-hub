-- 102 Video Archives. A searchable, filterable video library grouped by year +
-- category (e.g. "Zoom Meetings"), with optional Zoom recording link, a synced
-- meeting-chat replay, and shared assets. Manual entry (v1); a Zoom auto-import
-- can layer on later. Read by all non-guest staff; managed by admin/trainer.

create table if not exists public.archive_videos (
  id                uuid primary key default gen_random_uuid(),
  title             text not null default '',
  description       text not null default '',
  video_url         text not null default '',
  thumbnail_url     text not null default '',
  category          text not null default 'General',
  year              int  not null default extract(year from now())::int,
  presenter         text not null default '',
  topics            text[] not null default '{}',
  tags              text[] not null default '{}',
  zoom_recording_id text not null default '',
  duration_seconds  int,
  published         boolean not null default true,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint archive_videos_title_not_blank check (char_length(trim(title)) > 0)
);
create index if not exists archive_videos_year_idx on public.archive_videos (year desc, category);
create index if not exists archive_videos_category_idx on public.archive_videos (category);

create table if not exists public.archive_video_assets (
  id         uuid primary key default gen_random_uuid(),
  video_id   uuid not null references public.archive_videos(id) on delete cascade,
  title      text not null default '',
  url        text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint archive_video_assets_url_not_blank check (char_length(trim(url)) > 0)
);
create index if not exists archive_video_assets_video_idx on public.archive_video_assets (video_id);

create table if not exists public.archive_video_chat (
  id         uuid primary key default gen_random_uuid(),
  video_id   uuid not null references public.archive_videos(id) on delete cascade,
  ts_seconds int not null default 0,
  speaker    text not null default '',
  message    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists archive_video_chat_video_idx on public.archive_video_chat (video_id, ts_seconds);

alter table public.archive_videos      enable row level security;
alter table public.archive_video_assets enable row level security;
alter table public.archive_video_chat   enable row level security;

-- Read: any non-guest staffer. Write: admin/trainer.
drop policy if exists "archive_videos read" on public.archive_videos;
create policy "archive_videos read" on public.archive_videos
  for select to authenticated using (public.current_user_role() <> 'guest');
drop policy if exists "archive_videos write" on public.archive_videos;
create policy "archive_videos write" on public.archive_videos
  for all to authenticated
  using (public.current_user_role() in ('admin','trainer'))
  with check (public.current_user_role() in ('admin','trainer'));

drop policy if exists "archive_video_assets read" on public.archive_video_assets;
create policy "archive_video_assets read" on public.archive_video_assets
  for select to authenticated using (public.current_user_role() <> 'guest');
drop policy if exists "archive_video_assets write" on public.archive_video_assets;
create policy "archive_video_assets write" on public.archive_video_assets
  for all to authenticated
  using (public.current_user_role() in ('admin','trainer'))
  with check (public.current_user_role() in ('admin','trainer'));

drop policy if exists "archive_video_chat read" on public.archive_video_chat;
create policy "archive_video_chat read" on public.archive_video_chat
  for select to authenticated using (public.current_user_role() <> 'guest');
drop policy if exists "archive_video_chat write" on public.archive_video_chat;
create policy "archive_video_chat write" on public.archive_video_chat
  for all to authenticated
  using (public.current_user_role() in ('admin','trainer'))
  with check (public.current_user_role() in ('admin','trainer'));

grant select, insert, update, delete on public.archive_videos       to authenticated;
grant select, insert, update, delete on public.archive_video_assets to authenticated;
grant select, insert, update, delete on public.archive_video_chat   to authenticated;

create or replace function public.set_archive_videos_updated_at()
returns trigger language plpgsql as $BODY$
begin new.updated_at = now(); return new; end;
$BODY$;
drop trigger if exists archive_videos_updated_at on public.archive_videos;
create trigger archive_videos_updated_at before update on public.archive_videos
  for each row execute function public.set_archive_videos_updated_at();
