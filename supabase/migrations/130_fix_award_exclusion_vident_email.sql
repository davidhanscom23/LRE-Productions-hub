-- Fix Hub monthly-award exclusion: the seed in 085/086 (cloned from the Y? hub)
-- excluded lower('david@yentertainmentdjs.com'), but David's Vident profile is
-- david@yentertainmentdjs.com — so he was never excluded here and won the
-- 2026-08 Overall Leader + Monthly MVP trophies. The 2026-08 awards were
-- re-issued to the correct winner via the SQL editor on 2026-09-01; this
-- migration makes the exclusion itself permanent. Safe to re-run.

alter table public.profiles disable trigger profiles_enforce_self_edit_columns;
update public.profiles
set award_excluded = true
where lower(email) in (
  lower('david@yentertainmentdjs.com'),
  lower('david@yentertainmentdjs.com')
);
alter table public.profiles enable trigger profiles_enforce_self_edit_columns;
