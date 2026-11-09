-- Hub-native CRM create for admins + Leads (Phase 1).
-- source_event = 'hub' marks rows created in the Hub (not Zapier).

-- Leads may insert clients / projects (admin already has ALL via existing policy)
drop policy if exists "honeybook_clients trainer insert" on public.honeybook_clients;
create policy "honeybook_clients trainer insert"
  on public.honeybook_clients for insert to authenticated
  with check (public.current_user_role() = 'trainer');

drop policy if exists "honeybook_projects trainer insert" on public.honeybook_projects;
create policy "honeybook_projects trainer insert"
  on public.honeybook_projects for insert to authenticated
  with check (public.current_user_role() = 'trainer');

-- Stage change audit
create table if not exists public.honeybook_project_stage_events (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.honeybook_projects (id) on delete cascade,
  from_stage  text not null default '',
  to_stage    text not null default '',
  changed_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint honeybook_project_stage_events_to_not_blank check (
    char_length(trim(to_stage)) > 0
  )
);

create index if not exists honeybook_project_stage_events_project_idx
  on public.honeybook_project_stage_events (project_id, created_at desc);

alter table public.honeybook_project_stage_events enable row level security;

drop policy if exists "honeybook stage events admin all"
  on public.honeybook_project_stage_events;
create policy "honeybook stage events admin all"
  on public.honeybook_project_stage_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "honeybook stage events trainer select"
  on public.honeybook_project_stage_events;
create policy "honeybook stage events trainer select"
  on public.honeybook_project_stage_events for select to authenticated
  using (public.current_user_role() = 'trainer');

drop policy if exists "honeybook stage events trainer insert"
  on public.honeybook_project_stage_events;
create policy "honeybook stage events trainer insert"
  on public.honeybook_project_stage_events for insert to authenticated
  with check (public.current_user_role() = 'trainer');

grant select, insert on public.honeybook_project_stage_events to authenticated;
grant select, insert, update, delete on public.honeybook_project_stage_events to service_role;

comment on table public.honeybook_project_stage_events is
  'Audit log of Hub CRM project stage changes (admins + Leads).';
