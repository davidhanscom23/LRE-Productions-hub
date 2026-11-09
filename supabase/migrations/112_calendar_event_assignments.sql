-- Hub-side staff assignment for calendar events (HoneyBook/Google iCal, etc.).
-- HoneyBook has no native assignee field the Hub can read, so admins assign
-- people on the event card; Availability uses those names as Booked.

create table if not exists public.calendar_event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_uid text not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  unique (event_uid, profile_id)
);

create index if not exists calendar_event_assignments_event_uid_idx
  on public.calendar_event_assignments (event_uid);

create index if not exists calendar_event_assignments_profile_id_idx
  on public.calendar_event_assignments (profile_id);

alter table public.calendar_event_assignments enable row level security;

drop policy if exists "calendar_event_assignments_select_authenticated"
  on public.calendar_event_assignments;
create policy "calendar_event_assignments_select_authenticated"
  on public.calendar_event_assignments for select to authenticated
  using (true);

drop policy if exists "calendar_event_assignments_write_admin_trainer"
  on public.calendar_event_assignments;
create policy "calendar_event_assignments_write_admin_trainer"
  on public.calendar_event_assignments for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'trainer')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'trainer')
    )
  );

grant select, insert, update, delete on public.calendar_event_assignments to authenticated;
grant select, insert, update, delete on public.calendar_event_assignments to service_role;

-- Guests are authenticated; block them explicitly (same pattern as 098).
drop policy if exists "calendar_event_assignments_deny_guests"
  on public.calendar_event_assignments;
create policy "calendar_event_assignments_deny_guests"
  on public.calendar_event_assignments
  as restrictive
  for all
  to authenticated
  using (
    not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'guest'
    )
  )
  with check (
    not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'guest'
    )
  );

comment on table public.calendar_event_assignments is
  'Hub-assigned staff for a calendar event uid (HoneyBook/Google iCal). Feeds Availability Booked status.';
