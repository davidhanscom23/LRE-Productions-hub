-- 055 Hiring: job openings + candidate pipeline. Admin-only (candidate PII).

create table if not exists public.job_openings (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  department  text not null default '',
  description text not null default '',
  status      text not null default 'open' check (status in ('open','closed')),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  constraint job_openings_title_not_blank check (char_length(trim(title)) > 0)
);

create table if not exists public.candidates (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  email      text not null default '',
  phone      text not null default '',
  job_id     uuid references public.job_openings(id) on delete set null,
  stage      text not null default 'applied'
               check (stage in ('applied','screening','interview','offer','hired','rejected')),
  notes      text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidates_name_not_blank check (char_length(trim(full_name)) > 0)
);

create index if not exists candidates_job_idx on public.candidates (job_id);
create index if not exists candidates_stage_idx on public.candidates (stage);

alter table public.job_openings enable row level security;
alter table public.candidates enable row level security;

-- Admin-only for both tables (read + write).
drop policy if exists "job_openings admin all" on public.job_openings;
create policy "job_openings admin all"
  on public.job_openings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "candidates admin all" on public.candidates;
create policy "candidates admin all"
  on public.candidates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.job_openings to authenticated;
grant select, insert, update, delete on public.candidates to authenticated;
