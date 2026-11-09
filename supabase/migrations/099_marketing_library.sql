-- 093 Marketing Library. Review links, photo-library links, and a searchable,
-- tag-filterable video library (promo / highlight reels). Read by everyone
-- (including guests); managed by admins and trainers.

-- Simple link rows for the "Reviews" and "Photo Library" sections.
create table if not exists public.marketing_links (
  id         uuid primary key default gen_random_uuid(),
  section    text not null check (section in ('reviews','photos')),
  label      text not null default '',
  url        text not null default '',
  sort_order int  not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint marketing_links_label_not_blank check (char_length(trim(label)) > 0)
);

create index if not exists marketing_links_section_idx
  on public.marketing_links (section, sort_order);

-- Video library: promo, event, and highlight reels with category + tags.
create table if not exists public.marketing_videos (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  description text not null default '',
  url         text not null default '',
  category    text not null default 'Wedding',
  dj_name     text not null default '',
  tags        text[] not null default '{}',
  sort_order  int  not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint marketing_videos_title_not_blank check (char_length(trim(title)) > 0)
);

create index if not exists marketing_videos_category_idx
  on public.marketing_videos (category);
create index if not exists marketing_videos_created_idx
  on public.marketing_videos (created_at desc);

alter table public.marketing_links  enable row level security;
alter table public.marketing_videos enable row level security;

-- Read: any authenticated user (staff + guests).
drop policy if exists "marketing_links read" on public.marketing_links;
create policy "marketing_links read"
  on public.marketing_links for select to authenticated using (true);

drop policy if exists "marketing_videos read" on public.marketing_videos;
create policy "marketing_videos read"
  on public.marketing_videos for select to authenticated using (true);

-- Write: admin or trainer only.
drop policy if exists "marketing_links write" on public.marketing_links;
create policy "marketing_links write"
  on public.marketing_links for all to authenticated
  using (public.current_user_role() in ('admin','trainer'))
  with check (public.current_user_role() in ('admin','trainer'));

drop policy if exists "marketing_videos write" on public.marketing_videos;
create policy "marketing_videos write"
  on public.marketing_videos for all to authenticated
  using (public.current_user_role() in ('admin','trainer'))
  with check (public.current_user_role() in ('admin','trainer'));

grant select, insert, update, delete on public.marketing_links  to authenticated;
grant select, insert, update, delete on public.marketing_videos to authenticated;
