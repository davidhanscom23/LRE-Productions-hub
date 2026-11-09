-- Scheduled huddles: an admin can schedule a huddle for a future time instead of
-- only starting one immediately. A scheduled huddle is NOT live — it waits until
-- the admin manually starts it. Two lazy reminders fire off the huddle poll:
--   * reminded_soon_at  — a ~10-min-before heads-up broadcast to staff
--   * reminded_start_at — a start-time nudge to admins ("time to start it")
-- Both columns double as atomic claim flags so each reminder fires exactly once.

alter table public.zoom_huddles
  add column if not exists scheduled_at timestamptz,
  add column if not exists reminded_soon_at timestamptz,
  add column if not exists reminded_start_at timestamptz;

-- A scheduled huddle has no started_at / ends_at until it actually goes live,
-- so these can no longer be required.
alter table public.zoom_huddles alter column started_at drop not null;
alter table public.zoom_huddles alter column started_at drop default;
alter table public.zoom_huddles alter column ends_at drop not null;

-- Fast lookup of the next pending scheduled huddle.
create index if not exists zoom_huddles_scheduled_idx
  on public.zoom_huddles (scheduled_at)
  where started_at is null and ended_at is null;
