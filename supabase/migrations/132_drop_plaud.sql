-- 132 Remove the PLAUD meetings module.
-- The /plaud pages, sync cron, and libraries are deleted from the app in the
-- same release; this drops the backing table and its helper function.

drop table if exists public.plaud_meetings cascade;
drop function if exists public.set_plaud_meetings_updated_at() cascade;
