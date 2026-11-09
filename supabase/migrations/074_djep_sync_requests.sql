-- On-demand DJEP sync queue.
-- A hub user clicks "Sync Forms" -> a row lands here; the always-on sync station
-- polls for pending rows, pulls that event from DJEP immediately, and the row is
-- cleared when fresh planning is ingested for that event.

create table if not exists public.djep_sync_requests (
  id uuid primary key default gen_random_uuid(),
  djep_event_id text not null,
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now()
);

create index if not exists djep_sync_requests_event_idx
  on public.djep_sync_requests (djep_event_id);
create index if not exists djep_sync_requests_requested_at_idx
  on public.djep_sync_requests (requested_at);

alter table public.djep_sync_requests enable row level security;

-- Signed-in hub users can queue a sync and see queued rows.
drop policy if exists djep_sync_requests_insert on public.djep_sync_requests;
create policy djep_sync_requests_insert
  on public.djep_sync_requests for insert
  to authenticated
  with check (true);

drop policy if exists djep_sync_requests_read on public.djep_sync_requests;
create policy djep_sync_requests_read
  on public.djep_sync_requests for select
  to authenticated
  using (true);

grant select, insert on public.djep_sync_requests to authenticated;
grant select, insert, update, delete on public.djep_sync_requests to service_role;
