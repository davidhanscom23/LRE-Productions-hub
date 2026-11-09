-- 057 New-hire Onboarding. Admin-managed plans + checklist items.

create table if not exists public.onboarding_plans (
  id           uuid primary key default gen_random_uuid(),
  subject_name text not null,
  profile_id   uuid references public.profiles(id) on delete set null,
  role_title   text not null default '',
  start_date   date,
  status       text not null default 'active' check (status in ('active','complete','archived')),
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  constraint onboarding_subject_not_blank check (char_length(trim(subject_name)) > 0)
);

create table if not exists public.onboarding_items (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.onboarding_plans(id) on delete cascade,
  label      text not null,
  category   text not null default 'other'
               check (category in ('accounts','equipment','paperwork','training','other')),
  is_done    boolean not null default false,
  done_at    timestamptz,
  done_by    uuid references public.profiles(id),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_items_plan_idx on public.onboarding_items (plan_id);

alter table public.onboarding_plans enable row level security;
alter table public.onboarding_items enable row level security;

drop policy if exists "onboarding_plans admin all" on public.onboarding_plans;
create policy "onboarding_plans admin all"
  on public.onboarding_plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "onboarding_items admin all" on public.onboarding_items;
create policy "onboarding_items admin all"
  on public.onboarding_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.onboarding_plans to authenticated;
grant select, insert, update, delete on public.onboarding_items to authenticated;
