-- 048: End of Event Report memorable_moment + People social profile links.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- event_reports.memorable_moment (matches event_packets)
-- ---------------------------------------------------------------------------
alter table public.event_reports
  add column if not exists memorable_moment text not null default '';

comment on column public.event_reports.memorable_moment is
  'Highlight worth sharing — same idea as event_packets.memorable_moment.';

-- ---------------------------------------------------------------------------
-- profiles social links (Facebook, Instagram, LinkedIn, X/Twitter)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists linkedin_url text,
  add column if not exists twitter_url text;

comment on column public.profiles.facebook_url is 'Optional public Facebook profile URL.';
comment on column public.profiles.instagram_url is 'Optional public Instagram profile URL.';
comment on column public.profiles.linkedin_url is 'Optional public LinkedIn profile URL.';
comment on column public.profiles.twitter_url is 'Optional public X (Twitter) profile URL.';

-- 014 revoked SELECT(djep_ical_url), which puts profiles on column-level grants.
-- New columns must be granted explicitly or authenticated selects fail.
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

-- Allow non-admins to self-edit social URL columns (in addition to phone/avatar/bio).
-- Preserve ownership + djep_ical_url guards from 023.
create or replace function public.enforce_profile_self_edit_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  -- Only the owner's own row can be updated by non-admins (RLS already enforces).
  if auth.uid() is distinct from old.id then
    raise exception 'Only admins can edit other people''s profiles';
  end if;

  if new.id is distinct from old.id then
    raise exception 'Cannot change profile id';
  end if;

  if new.full_name is distinct from old.full_name
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.departments is distinct from old.departments
    or new.title is distinct from old.title
    or new.birthday is distinct from old.birthday
    or new.start_date is distinct from old.start_date
    or new.is_active is distinct from old.is_active
    or new.color is distinct from old.color
    or new.reports_to is distinct from old.reports_to
    or new.created_at is distinct from old.created_at
  then
    raise exception 'You can only update your phone, avatar URL, bio, and social links';
  end if;

  -- djep_ical_url may not exist on older DBs; guard via to_jsonb
  if to_jsonb(new) ? 'djep_ical_url'
    and to_jsonb(old) ? 'djep_ical_url'
    and (to_jsonb(new) -> 'djep_ical_url') is distinct from (to_jsonb(old) -> 'djep_ical_url')
  then
    raise exception 'You can only update your phone, avatar URL, bio, and social links';
  end if;

  return new;
end;
$$;

comment on function public.enforce_profile_self_edit_columns() is
  'Non-admins may only change phone, avatar_url, bio, social URLs (and theme_preference) on their own profile.';
