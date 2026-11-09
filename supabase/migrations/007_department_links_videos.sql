-- Teams / Departments: quick links and tutorial videos per department
-- Departments: DJ, Photobooth, AV
-- RLS: any authenticated user can read; admin/trainer can write
-- Uses public.current_user_role() / public.is_admin() — NOT JWT claims

-- ---------------------------------------------------------------------------
-- department_links
-- ---------------------------------------------------------------------------

create table public.department_links (
  id uuid primary key default gen_random_uuid(),
  department text not null
    check (department in ('Audiovisual', 'Corporate', 'Wedding & Social', 'Golf')),
  title text not null,
  url text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null default auth.uid()
);

create index department_links_department_idx on public.department_links (department);
create index department_links_created_at_idx on public.department_links (created_at desc);

alter table public.department_links enable row level security;

create policy "Authenticated users can read department links"
on public.department_links
for select
to authenticated
using (true);

create policy "Admins and trainers can insert department links"
on public.department_links
for insert
to authenticated
with check (
  public.current_user_role() in ('admin', 'trainer')
);

create policy "Admins and trainers can update department links"
on public.department_links
for update
to authenticated
using (public.current_user_role() in ('admin', 'trainer'))
with check (public.current_user_role() in ('admin', 'trainer'));

create policy "Admins and trainers can delete department links"
on public.department_links
for delete
to authenticated
using (public.current_user_role() in ('admin', 'trainer'));

-- ---------------------------------------------------------------------------
-- department_videos
-- ---------------------------------------------------------------------------

create table public.department_videos (
  id uuid primary key default gen_random_uuid(),
  department text not null
    check (department in ('Audiovisual', 'Corporate', 'Wedding & Social', 'Golf')),
  title text not null,
  description text not null default '',
  video_url text not null,
  category text not null default '',
  thumbnail_url text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null default auth.uid()
);

create index department_videos_department_idx on public.department_videos (department);
create index department_videos_category_idx on public.department_videos (category);
create index department_videos_created_at_idx on public.department_videos (created_at desc);

alter table public.department_videos enable row level security;

create policy "Authenticated users can read department videos"
on public.department_videos
for select
to authenticated
using (true);

create policy "Admins and trainers can insert department videos"
on public.department_videos
for insert
to authenticated
with check (
  public.current_user_role() in ('admin', 'trainer')
);

create policy "Admins and trainers can update department videos"
on public.department_videos
for update
to authenticated
using (public.current_user_role() in ('admin', 'trainer'))
with check (public.current_user_role() in ('admin', 'trainer'));

create policy "Admins and trainers can delete department videos"
on public.department_videos
for delete
to authenticated
using (public.current_user_role() in ('admin', 'trainer'));
