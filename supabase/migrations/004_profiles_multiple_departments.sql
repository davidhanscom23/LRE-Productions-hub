-- People: allow multiple departments per profile
-- Migrates single `department` text → `departments` text[]

alter table public.profiles
  add column if not exists departments text[] not null default '{}';

-- Copy existing single department into the new array
update public.profiles
set departments = array[department]
where department is not null
  and (departments = '{}' or departments is null);

-- Drop the old single-value column + index
drop index if exists profiles_department_idx;
alter table public.profiles drop column if exists department;

-- Every value in the array must be a known department (empty array is OK)
alter table public.profiles
  drop constraint if exists profiles_departments_valid;

alter table public.profiles
  add constraint profiles_departments_valid check (
    departments <@ array['Audiovisual', 'Corporate', 'Wedding & Social', 'Golf', 'Office']::text[]
  );

create index if not exists profiles_departments_gin_idx
  on public.profiles using gin (departments);
