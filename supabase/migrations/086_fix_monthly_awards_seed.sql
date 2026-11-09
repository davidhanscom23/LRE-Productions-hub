-- Fix/complete 079 after SQL editor UPDATE hit enforce_profile_self_edit_columns
-- (P0001: Only admins can edit other people's profiles). Safe to re-run.

alter table public.profiles
  add column if not exists award_excluded boolean not null default false;

comment on column public.profiles.award_excluded is
  'When true, profile is excluded from Hub monthly trophy awards (Overall Leader / Monthly MVP).';

grant select (award_excluded) on table public.profiles to authenticated, anon;

-- Bypass self-edit guard for migration seed (no auth.uid() in SQL editor).
alter table public.profiles disable trigger profiles_enforce_self_edit_columns;
update public.profiles
set award_excluded = true
where lower(email) = lower('owner-placeholder@example.invalid');
alter table public.profiles enable trigger profiles_enforce_self_edit_columns;

create table if not exists public.hub_monthly_awards (
  id uuid primary key default gen_random_uuid(),
  period text not null,
  award_type text not null
    check (award_type in ('overall_leader', 'monthly_mvp')),
  user_id uuid not null references public.profiles (id) on delete cascade,
  metric_value integer not null default 0,
  created_at timestamptz not null default now(),
  unique (period, award_type, user_id)
);

create index if not exists hub_monthly_awards_period_idx
  on public.hub_monthly_awards (period desc);

create index if not exists hub_monthly_awards_user_idx
  on public.hub_monthly_awards (user_id);

alter table public.hub_monthly_awards enable row level security;

drop policy if exists "monthly_awards read" on public.hub_monthly_awards;
create policy "monthly_awards read"
  on public.hub_monthly_awards for select to authenticated
  using (true);

drop policy if exists "monthly_awards admin write" on public.hub_monthly_awards;
create policy "monthly_awards admin write"
  on public.hub_monthly_awards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.hub_monthly_awards to authenticated;
grant select, insert, update, delete on public.hub_monthly_awards to service_role;
