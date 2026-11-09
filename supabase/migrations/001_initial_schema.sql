-- Y Entertainment Hub — initial schema
-- Roles: admin, trainer, staff
-- Invite-only: disable public signup in Supabase Auth settings.

-- ---------------------------------------------------------------------------
-- Roles enum + profiles
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'trainer', 'staff');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'staff',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_full_name_idx on public.profiles (full_name);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile when an invited user accepts / signs up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, 'staff'), '@', 1)
    ),
    coalesce(
      (new.raw_user_meta_data ->> 'role')::public.user_role,
      'staff'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role helpers (used by RLS)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security — profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Logged-in staff can see the directory (People module later)
create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

-- Users can update their own row; role changes are blocked in the trigger below
create policy "Users can update own profile details"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Admins can update any profile (including roles)
create policy "Admins can update any profile"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No public inserts — profiles are created by the auth trigger only
create policy "Admins can insert profiles"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

-- Only admins may change role values
create or replace function public.enforce_role_change_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change user roles';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_role_change
before update on public.profiles
for each row execute function public.enforce_role_change_admin_only();

-- ---------------------------------------------------------------------------
-- Storage — resources bucket (files for Resources module later)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resources',
  'resources',
  false,
  52428800, -- 50 MB
  null
)
on conflict (id) do nothing;

-- Authenticated staff can read resource files
create policy "Authenticated users can read resources"
on storage.objects
for select
to authenticated
using (bucket_id = 'resources');

-- Trainers and admins can upload/update/delete resources
create policy "Trainers and admins can upload resources"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'resources'
  and public.current_user_role() in ('admin', 'trainer')
);

create policy "Trainers and admins can update resources"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'resources'
  and public.current_user_role() in ('admin', 'trainer')
);

create policy "Admins can delete resources"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'resources'
  and public.is_admin()
);
