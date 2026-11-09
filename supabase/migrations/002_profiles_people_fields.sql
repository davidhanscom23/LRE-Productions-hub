-- People module: extend profiles with directory fields

alter table public.profiles
  add column if not exists department text
    check (department is null or department in ('Audiovisual', 'Corporate', 'Wedding & Social', 'Golf', 'Office')),
  add column if not exists title text,
  add column if not exists phone text,
  add column if not exists birthday date,
  add column if not exists start_date date,
  add column if not exists bio text,
  add column if not exists is_active boolean not null default true;

create index if not exists profiles_department_idx on public.profiles (department);
create index if not exists profiles_is_active_idx on public.profiles (is_active);
create index if not exists profiles_birthday_idx on public.profiles (birthday);
