-- Resources module: metadata for files and links in the resources library

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default '',
  type text not null check (type in ('file', 'link')),
  url text not null,
  description text not null default '',
  visibility text not null default 'everyone'
    check (visibility in ('everyone', 'staff', 'admin')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index resources_category_idx on public.resources (category);
create index resources_type_idx on public.resources (type);
create index resources_visibility_idx on public.resources (visibility);
create index resources_created_at_idx on public.resources (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.resources enable row level security;

-- Signed-in users can read rows allowed by their role:
--   everyone → any authenticated user
--   staff    → staff, trainer, or admin
--   admin    → admin only
create policy "Users can read resources by visibility"
on public.resources
for select
to authenticated
using (
  visibility = 'everyone'
  or (
    visibility = 'staff'
    and public.current_user_role() in ('staff', 'trainer', 'admin')
  )
  or (
    visibility = 'admin'
    and public.is_admin()
  )
);

create policy "Admins and trainers can insert resources"
on public.resources
for insert
to authenticated
with check (
  public.current_user_role() in ('admin', 'trainer')
  and created_by = auth.uid()
);

create policy "Admins and trainers can update resources"
on public.resources
for update
to authenticated
using (public.current_user_role() in ('admin', 'trainer'))
with check (public.current_user_role() in ('admin', 'trainer'));

create policy "Admins can delete resources"
on public.resources
for delete
to authenticated
using (public.is_admin());
