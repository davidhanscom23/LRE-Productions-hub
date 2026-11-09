-- 049: Grant SELECT/UPDATE on profile social columns added in 048.
--
-- Migration 014 revoked SELECT on djep_ical_url, which switches profiles to
-- column-level privileges for authenticated/anon. Columns added after that
-- (including facebook_url / instagram_url / linkedin_url / twitter_url) do not
-- inherit those grants — selects that mention them fail with
-- "permission denied for table profiles", which also breaks layout profile
-- loading (Calendar nav disappears).
--
-- Safe to re-run.

grant select (
  facebook_url,
  instagram_url,
  linkedin_url,
  twitter_url
) on table public.profiles to authenticated, anon;

grant update (
  facebook_url,
  instagram_url,
  linkedin_url,
  twitter_url
) on table public.profiles to authenticated;

-- Belt-and-suspenders for other post-014 columns that the Hub selects.
grant select (color, theme_preference) on table public.profiles to authenticated, anon;
grant update (color, theme_preference) on table public.profiles to authenticated;
