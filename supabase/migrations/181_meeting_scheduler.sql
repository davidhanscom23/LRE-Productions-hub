-- Meeting scheduler: clients pick a time on /book/<slug>; staff manage hours at /scheduling.
-- Public booking runs server-side with the service role (no public table access).

create table if not exists public.meeting_types (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  title            text not null check (length(btrim(title)) > 0),
  description      text not null default '',
  duration_min     integer not null default 30 check (duration_min between 5 and 480),
  buffer_min       integer not null default 0 check (buffer_min between 0 and 120),
  min_notice_hours integer not null default 12 check (min_notice_hours between 0 and 720),
  max_days_ahead   integer not null default 60 check (max_days_ahead between 1 and 365),
  location         text not null default 'We will call you at the number you provide.',
  timezone         text not null default 'America/New_York',
  weekly           jsonb not null default '{}'::jsonb,
  host_id          uuid not null references public.profiles (id) on delete restrict,
  active           boolean not null default true,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.meeting_bookings (
  id                    uuid primary key default gen_random_uuid(),
  meeting_type_id       uuid not null references public.meeting_types (id) on delete cascade,
  host_id               uuid not null references public.profiles (id) on delete cascade,
  start_at              timestamptz not null,
  end_at                timestamptz not null,
  name                  text not null,
  email                 text not null,
  phone                 text not null default '',
  notes                 text not null default '',
  status                text not null default 'booked' check (status in ('booked', 'cancelled')),
  cancel_token          text not null unique,
  honeybook_project_id  uuid references public.honeybook_projects (id) on delete set null,
  created_at            timestamptz not null default now(),
  cancelled_at          timestamptz,
  constraint meeting_bookings_end_after_start check (end_at > start_at)
);

-- The same host can never hold two live bookings that start at the same moment.
create unique index if not exists meeting_bookings_host_start_uidx
  on public.meeting_bookings (host_id, start_at) where status = 'booked';
create index if not exists meeting_bookings_host_idx
  on public.meeting_bookings (host_id, start_at);

alter table public.meeting_types enable row level security;
alter table public.meeting_bookings enable row level security;

drop policy if exists "meeting types read staff" on public.meeting_types;
create policy "meeting types read staff"
  on public.meeting_types for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));

drop policy if exists "meeting types write admin lead" on public.meeting_types;
create policy "meeting types write admin lead"
  on public.meeting_types for all to authenticated
  using (public.current_user_role() in ('admin', 'trainer'))
  with check (public.current_user_role() in ('admin', 'trainer'));

drop policy if exists "meeting bookings read staff" on public.meeting_bookings;
create policy "meeting bookings read staff"
  on public.meeting_bookings for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));

drop policy if exists "meeting bookings write admin lead" on public.meeting_bookings;
create policy "meeting bookings write admin lead"
  on public.meeting_bookings for all to authenticated
  using (public.current_user_role() in ('admin', 'trainer'))
  with check (public.current_user_role() in ('admin', 'trainer'));

grant select, insert, update, delete on public.meeting_types to authenticated;
grant select, insert, update, delete on public.meeting_types to service_role;
grant select, insert, update, delete on public.meeting_bookings to authenticated;
grant select, insert, update, delete on public.meeting_bookings to service_role;
