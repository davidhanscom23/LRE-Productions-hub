-- 096 Hiring ATS upgrade: interview scheduling + reusable interview templates.
-- Admin-only (candidate PII), matching the rest of Hiring.

create table if not exists public.interview_schedules (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  scheduled_at timestamptz not null,
  interviewer  text not null default '',
  location     text not null default '',
  notes        text not null default '',
  status       text not null default 'scheduled'
                 check (status in ('scheduled','completed','canceled')),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists interview_schedules_candidate_idx
  on public.interview_schedules (candidate_id);
create index if not exists interview_schedules_when_idx
  on public.interview_schedules (scheduled_at);

create table if not exists public.interview_templates (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default '',
  track      text not null default 'general',
  questions  jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint interview_templates_title_not_blank check (char_length(trim(title)) > 0)
);

alter table public.interview_schedules enable row level security;
alter table public.interview_templates enable row level security;

drop policy if exists "interview_schedules admin all" on public.interview_schedules;
create policy "interview_schedules admin all"
  on public.interview_schedules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "interview_templates admin all" on public.interview_templates;
create policy "interview_templates admin all"
  on public.interview_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.interview_schedules to authenticated;
grant select, insert, update, delete on public.interview_templates to authenticated;
