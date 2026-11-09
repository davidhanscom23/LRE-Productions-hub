-- Image Studio library: admin-generated stills saved for Hub reuse.
-- Safe to re-run.

create table if not exists public.studio_images (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  prompt text not null default '',
  model_id text not null,
  provider text not null
    check (provider in ('gemini', 'higgsfield')),
  aspect_ratio text not null default '4:5',
  image_size text,
  storage_path text not null,
  storage_provider text not null default 'supabase'
    check (storage_provider in ('supabase', 'bunny')),
  file_name text not null,
  media_type text not null default 'image',
  content_type text not null default 'image/png',
  created_at timestamptz not null default now()
);

create index if not exists studio_images_created_at_idx
  on public.studio_images (created_at desc);

create index if not exists studio_images_created_by_idx
  on public.studio_images (created_by);

comment on table public.studio_images is
  'Admin Image Studio library. Generated stills saved for staff reuse and packet attach.';

alter table public.studio_images enable row level security;

drop policy if exists "Staff can read studio images" on public.studio_images;
drop policy if exists "Admins insert studio images" on public.studio_images;
drop policy if exists "Admins update studio images" on public.studio_images;
drop policy if exists "Admins delete studio images" on public.studio_images;

-- Staff (non-guest) can browse the library for reuse; guests blocked below.
create policy "Staff can read studio images"
on public.studio_images
for select
to authenticated
using (public.current_user_role()::text is distinct from 'guest');

create policy "Admins insert studio images"
on public.studio_images
for insert
to authenticated
with check (public.is_admin());

create policy "Admins update studio images"
on public.studio_images
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete studio images"
on public.studio_images
for delete
to authenticated
using (public.is_admin());

-- Restrictive guest denials (same naming as 042_guest_rls.sql).
drop policy if exists guests_denied_studio_images_select on public.studio_images;
drop policy if exists guests_denied_studio_images_insert on public.studio_images;
drop policy if exists guests_denied_studio_images_update on public.studio_images;
drop policy if exists guests_denied_studio_images_delete on public.studio_images;

create policy guests_denied_studio_images_select
on public.studio_images as restrictive
for select to authenticated
using (not public.is_guest());

create policy guests_denied_studio_images_insert
on public.studio_images as restrictive
for insert to authenticated
with check (not public.is_guest());

create policy guests_denied_studio_images_update
on public.studio_images as restrictive
for update to authenticated
using (not public.is_guest())
with check (not public.is_guest());

create policy guests_denied_studio_images_delete
on public.studio_images as restrictive
for delete to authenticated
using (not public.is_guest());
