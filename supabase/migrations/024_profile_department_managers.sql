-- Per-department org chart managers (multi-dept staff can report to
-- different people in each department chart).

create table public.profile_department_managers (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  department text not null
    check (department in ('Audiovisual', 'Corporate', 'Wedding & Social', 'Golf', 'Office')),
  reports_to uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, department),
  check (reports_to is distinct from profile_id)
);

create index profile_department_managers_reports_to_idx
  on public.profile_department_managers (reports_to);

create index profile_department_managers_department_idx
  on public.profile_department_managers (department);

comment on table public.profile_department_managers is
  'Org-chart manager per department. A person in DJ + AV can have a different manager in each chart.';

-- Seed from existing global reports_to for each of the person's departments.
insert into public.profile_department_managers (profile_id, department, reports_to)
select p.id, d.department, p.reports_to
from public.profiles p
cross join lateral unnest(p.departments) as d(department)
where p.reports_to is not null
  and d.department in ('Audiovisual', 'Corporate', 'Wedding & Social', 'Golf', 'Office')
on conflict (profile_id, department) do nothing;

alter table public.profile_department_managers enable row level security;

create policy "Authenticated users can read department managers"
on public.profile_department_managers
for select
to authenticated
using (true);

create policy "Admins can insert department managers"
on public.profile_department_managers
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update department managers"
on public.profile_department_managers
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete department managers"
on public.profile_department_managers
for delete
to authenticated
using (public.is_admin());
