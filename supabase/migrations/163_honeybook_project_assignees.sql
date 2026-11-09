-- HoneyBook CRM: multi-staff project assignees, assignment approval requests,
-- and staff read access (edit only when assigned). Admin/Lead assign freely.

-- ---------------------------------------------------------------------------
-- Assignees
-- ---------------------------------------------------------------------------
create table if not exists public.honeybook_project_assignees (
  project_id  uuid not null references public.honeybook_projects (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (project_id, profile_id)
);

create index if not exists honeybook_project_assignees_profile_idx
  on public.honeybook_project_assignees (profile_id);

comment on table public.honeybook_project_assignees is
  'Staff assigned to a Hub CRM (HoneyBook) project. Multiple people allowed.';

alter table public.honeybook_project_assignees enable row level security;

drop policy if exists "honeybook_assignees select hb" on public.honeybook_project_assignees;
create policy "honeybook_assignees select hb"
  on public.honeybook_project_assignees for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));

drop policy if exists "honeybook_assignees admin all" on public.honeybook_project_assignees;
create policy "honeybook_assignees admin all"
  on public.honeybook_project_assignees for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "honeybook_assignees trainer write" on public.honeybook_project_assignees;
create policy "honeybook_assignees trainer write"
  on public.honeybook_project_assignees for all to authenticated
  using (public.current_user_role() = 'trainer')
  with check (public.current_user_role() = 'trainer');

grant select, insert, update, delete on public.honeybook_project_assignees to authenticated;
grant select, insert, update, delete on public.honeybook_project_assignees to service_role;

-- ---------------------------------------------------------------------------
-- Assignment requests (staff nominating someone else → admin approval)
-- ---------------------------------------------------------------------------
create table if not exists public.honeybook_assignment_requests (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.honeybook_projects (id) on delete cascade,
  requester_id       uuid not null references public.profiles (id) on delete cascade,
  target_profile_id  uuid not null references public.profiles (id) on delete cascade,
  action             text not null check (action in ('add', 'remove')),
  status             text not null default 'pending'
                       check (status in ('pending', 'approved', 'denied')),
  note               text not null default '',
  reviewed_by        uuid references public.profiles (id) on delete set null,
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now()
);

create unique index if not exists honeybook_assignment_requests_pending_uidx
  on public.honeybook_assignment_requests (project_id, target_profile_id, action)
  where status = 'pending';

create index if not exists honeybook_assignment_requests_pending_idx
  on public.honeybook_assignment_requests (status, created_at desc)
  where status = 'pending';

comment on table public.honeybook_assignment_requests is
  'When staff try to assign/unassign someone else on a CRM project, admins approve here.';

alter table public.honeybook_assignment_requests enable row level security;

drop policy if exists "honeybook_assign_req admin all" on public.honeybook_assignment_requests;
create policy "honeybook_assign_req admin all"
  on public.honeybook_assignment_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "honeybook_assign_req select own" on public.honeybook_assignment_requests;
create policy "honeybook_assign_req select own"
  on public.honeybook_assignment_requests for select to authenticated
  using (
    public.current_user_role() in ('admin', 'trainer', 'staff')
  );

drop policy if exists "honeybook_assign_req staff insert" on public.honeybook_assignment_requests;
create policy "honeybook_assign_req staff insert"
  on public.honeybook_assignment_requests for insert to authenticated
  with check (
    public.current_user_role() in ('staff', 'trainer')
    and requester_id = auth.uid()
    and status = 'pending'
  );

grant select, insert, update, delete on public.honeybook_assignment_requests to authenticated;
grant select, insert, update, delete on public.honeybook_assignment_requests to service_role;

-- ---------------------------------------------------------------------------
-- Staff can read CRM mirror; update projects only when assigned
-- ---------------------------------------------------------------------------
drop policy if exists "honeybook_clients staff select" on public.honeybook_clients;
create policy "honeybook_clients staff select"
  on public.honeybook_clients for select to authenticated
  using (public.current_user_role() = 'staff');

drop policy if exists "honeybook_projects staff select" on public.honeybook_projects;
create policy "honeybook_projects staff select"
  on public.honeybook_projects for select to authenticated
  using (public.current_user_role() = 'staff');

drop policy if exists "honeybook_projects staff update assigned" on public.honeybook_projects;
create policy "honeybook_projects staff update assigned"
  on public.honeybook_projects for update to authenticated
  using (
    public.current_user_role() = 'staff'
    and exists (
      select 1 from public.honeybook_project_assignees a
      where a.project_id = honeybook_projects.id
        and a.profile_id = auth.uid()
    )
  )
  with check (
    public.current_user_role() = 'staff'
    and exists (
      select 1 from public.honeybook_project_assignees a
      where a.project_id = honeybook_projects.id
        and a.profile_id = auth.uid()
    )
  );

drop policy if exists "honeybook_payments staff select" on public.honeybook_payments;
create policy "honeybook_payments staff select"
  on public.honeybook_payments for select to authenticated
  using (public.current_user_role() = 'staff');

-- Assignees may write stage history on their projects
drop policy if exists "honeybook_stage_events staff insert" on public.honeybook_project_stage_events;
create policy "honeybook_stage_events staff insert"
  on public.honeybook_project_stage_events for insert to authenticated
  with check (
    public.current_user_role() = 'staff'
    and exists (
      select 1 from public.honeybook_project_assignees a
      where a.project_id = honeybook_project_stage_events.project_id
        and a.profile_id = auth.uid()
    )
  );

drop policy if exists "honeybook_stage_events staff select" on public.honeybook_project_stage_events;
create policy "honeybook_stage_events staff select"
  on public.honeybook_project_stage_events for select to authenticated
  using (public.current_user_role() = 'staff');

comment on table public.honeybook_projects is
  'HoneyBook project mirror + Hub CRM. Admins/Leads full write; staff select all, update when assigned.';
