-- Onboarding resource cards (Google Form / Sheet / Doc links)

create table public.onboarding_resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  url text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index onboarding_resources_sort_order_idx
  on public.onboarding_resources (sort_order);

alter table public.onboarding_resources enable row level security;

create policy "Authenticated users can read onboarding resources"
on public.onboarding_resources
for select
to authenticated
using (true);

create policy "Admins can insert onboarding resources"
on public.onboarding_resources
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update onboarding resources"
on public.onboarding_resources
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete onboarding resources"
on public.onboarding_resources
for delete
to authenticated
using (public.is_admin());

insert into public.onboarding_resources (slug, title, description, url, sort_order)
values
  (
    'dj-onboarding-form',
    'DJ Onboarding Form',
    'Complete the DJ new hire onboarding form',
    '',
    10
  ),
  (
    'onboarding-checklist',
    'Onboarding Checklist',
    'Step-by-step checklist for new team members',
    '',
    20
  ),
  (
    'av-onboarding-form',
    'AV Onboarding Form',
    'Complete the AV team onboarding form',
    '',
    30
  ),
  (
    'av-interview-questions',
    'Interview Questions - AV',
    'AV interview questions document',
    '',
    40
  ),
  (
    'photobooth-onboarding-form',
    'Photobooth Onboarding Form',
    'Complete the Photobooth new hire onboarding form',
    '',
    50
  ),
  (
    'office-onboarding-form',
    'Office Onboarding Form',
    'Complete the Office new hire onboarding form',
    '',
    60
  )
on conflict (slug) do nothing;
