-- DJEP per-event planning capture (PROTOTYPE)
-- Stores the planning tabs pulled from DJ Event Planner for one event, keyed by
-- the numeric DJEP event id (same id parsed from the iCal UID: EVENTID:{id}).

create table if not exists public.djep_event_planning (
  id uuid primary key default gen_random_uuid(),
  djep_event_id text not null unique,
  origin text,
  collected_at timestamptz not null default now(),
  forms jsonb not null default '[]'::jsonb,
  tabs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists djep_event_planning_event_idx
  on public.djep_event_planning (djep_event_id);

alter table public.djep_event_planning enable row level security;

-- Signed-in hub users can read planning data; writes go through the ingest route
-- using the service role key (which bypasses RLS).
drop policy if exists djep_planning_read on public.djep_event_planning;
create policy djep_planning_read
  on public.djep_event_planning for select
  to authenticated
  using (true);

-- Table privileges (this local Postgres image doesn't grant these by default;
-- see the note in supabase/seed.sql).
grant select on public.djep_event_planning to authenticated;
grant select, insert, update on public.djep_event_planning to service_role;
