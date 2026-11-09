-- Org Chart: optional manager relationship on profiles

alter table public.profiles
  add column if not exists reports_to uuid
    references public.profiles (id) on delete set null;

create index if not exists profiles_reports_to_idx
  on public.profiles (reports_to);

comment on column public.profiles.reports_to is
  'Manager for org chart; null = top-level / no manager assigned';
