-- Team "huddle" state: when an admin starts a Zoom huddle, a row lands here and
-- an active banner + notification points everyone at the join link until it ends.

create table if not exists public.zoom_huddles (
  id uuid primary key default gen_random_uuid(),
  join_url text not null,
  topic text,
  started_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz
);

-- Fast lookup of the current active huddle (not ended, not past its window).
create index if not exists zoom_huddles_active_idx
  on public.zoom_huddles (ended_at, ends_at);

alter table public.zoom_huddles enable row level security;

-- Any signed-in user can see the active huddle (to show the Join banner).
drop policy if exists zoom_huddles_read on public.zoom_huddles;
create policy zoom_huddles_read
  on public.zoom_huddles for select
  to authenticated
  using (true);

grant select on public.zoom_huddles to authenticated;
grant select, insert, update, delete on public.zoom_huddles to service_role;
