-- Per-staff calendar subscription token: a private, revocable key that powers
-- a read-only iCal feed of that person's assigned events (Google/Apple subscribe
-- to it by URL). The token is the secret; rotating it revokes old subscriptions.

alter table public.profiles
  add column if not exists calendar_feed_token text;

-- Backfill existing rows. The profiles_enforce_self_edit_columns trigger blocks
-- updates that have no auth context (migrations, SQL editor), so disable it just
-- for this backfill. calendar_feed_token is not a guarded column, so ordinary
-- self-edits from the app are unaffected.
alter table public.profiles disable trigger profiles_enforce_self_edit_columns;

update public.profiles
  set calendar_feed_token =
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  where calendar_feed_token is null;

alter table public.profiles enable trigger profiles_enforce_self_edit_columns;

alter table public.profiles
  alter column calendar_feed_token set default
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

create unique index if not exists profiles_calendar_feed_token_idx
  on public.profiles (calendar_feed_token);
