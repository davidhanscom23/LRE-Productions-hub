-- Remove Scorecards module (embedded Google Sheets dashboards).
-- Historical create lives in 101_scorecards.sql; this drops the table in production.

drop policy if exists "scorecards write" on public.scorecards;
drop policy if exists "scorecards read" on public.scorecards;
drop index if exists public.scorecards_sort_idx;
drop table if exists public.scorecards;
