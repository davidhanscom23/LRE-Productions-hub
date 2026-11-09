-- 067 Public hiring applications (careers intake).
-- Anon can insert only; admins read/update/delete. Promote into candidates from Hiring UI.

create table if not exists public.hiring_applications (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email         text not null default '',
  phone         text not null default '',
  role_interest text not null default '',
  message       text not null default '',
  resume_url    text not null default '',
  status        text not null default 'pending'
                  check (status in ('pending','promoted','archived','rejected')),
  candidate_id  uuid references public.candidates(id) on delete set null,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint hiring_applications_name_not_blank check (char_length(trim(full_name)) > 0)
);

create index if not exists hiring_applications_status_idx
  on public.hiring_applications (status);
create index if not exists hiring_applications_created_idx
  on public.hiring_applications (created_at desc);

alter table public.hiring_applications enable row level security;

-- Public careers form: anyone (anon) may submit an application.
drop policy if exists "hiring_applications anon insert" on public.hiring_applications;
create policy "hiring_applications anon insert"
  on public.hiring_applications for insert to anon
  with check (status = 'pending');

-- Authenticated staff should not insert via this table (use admin Hiring for candidates).
-- Admins manage applications.
drop policy if exists "hiring_applications admin all" on public.hiring_applications;
create policy "hiring_applications admin all"
  on public.hiring_applications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant insert on public.hiring_applications to anon;
grant select, insert, update, delete on public.hiring_applications to authenticated;
