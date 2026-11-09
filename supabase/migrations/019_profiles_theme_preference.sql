-- Per-user Appearance preference for the Hub (light / dark / system).
-- Users can update their own value via existing "Users can update own profile details" RLS.

alter table public.profiles
  add column if not exists theme_preference text;

alter table public.profiles
  drop constraint if exists profiles_theme_preference_check;

alter table public.profiles
  add constraint profiles_theme_preference_check
  check (
    theme_preference is null
    or theme_preference in ('light', 'dark', 'system')
  );

comment on column public.profiles.theme_preference is
  'Hub Appearance: light, dark, or system (follow device). Null means unset — client defaults to system.';
