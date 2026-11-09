-- Remove database leftovers carried over from the Y? Entertainment Hub.
-- Safe to re-run (everything is guarded with IF EXISTS).

-- 1. Hub Points: retire the "Music Charts" discovery task.
--    Points already awarded stay in the ledger (hub_point_events.achievement_id
--    becomes null); only the task and its per-user "unlocked" marker go away.
delete from public.hub_achievements
where key = 'discover_music_charts';

-- 2. Unused saved tracks table (Music Charts).
drop table if exists public.saved_tracks cascade;

-- 3. Personal DJEP calendar link on profiles.
--    The trigger references the column directly, so drop it first.
drop trigger if exists profiles_enforce_djep_ical_url_admin_only on public.profiles;
drop function if exists public.enforce_djep_ical_url_admin_only();
drop function if exists public.get_djep_ical_url(uuid);
drop function if exists public.has_djep_ical_url(uuid);
alter table public.profiles drop column if exists djep_ical_url;

-- 4. Unused DJEP planning / sync tables.
drop table if exists public.djep_event_planning cascade;
drop table if exists public.djep_sync_requests cascade;
