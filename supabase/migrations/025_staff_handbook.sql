-- Singleton Staff Handbook document (content JSON + draft flag).
-- While is_draft is true, only admins can read the row (and the Hub hides the nav link).

create table public.staff_handbook (
  id integer primary key default 1 check (id = 1),
  is_draft boolean not null default true,
  content jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.staff_handbook enable row level security;

create policy "Read staff handbook when published or admin"
on public.staff_handbook
for select
to authenticated
using (not is_draft or public.is_admin());

create policy "Admins can insert staff handbook"
on public.staff_handbook
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update staff handbook"
on public.staff_handbook
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete staff handbook"
on public.staff_handbook
for delete
to authenticated
using (public.is_admin());

comment on table public.staff_handbook is
  'Single-row Staff Handbook. Draft rows are admin-only; published content is readable by all signed-in staff.';
