-- Personal DJEP iCal feed URLs on profiles (sensitive).
-- Existing profiles RLS policies are left intact.
-- Column SELECT is revoked from authenticated; reads go through security-definer helpers.
-- Only admins may change the value (enforced by trigger).

alter table public.profiles
  add column if not exists djep_ical_url text;

comment on column public.profiles.djep_ical_url is
  'Personal DJEP dynamic iCal feed URL. Sensitive — server-side only; never send to the browser except admin edit flows.';

-- Block non-admins from changing this column (users can still update other own fields)
create or replace function public.enforce_djep_ical_url_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.djep_ical_url is distinct from old.djep_ical_url
     and not public.is_admin() then
    raise exception 'Only admins can change djep_ical_url';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_djep_ical_url_admin_only on public.profiles;

create trigger profiles_enforce_djep_ical_url_admin_only
before update on public.profiles
for each row
execute function public.enforce_djep_ical_url_admin_only();

-- Hide the column from generic SELECT * / SELECT djep_ical_url by clients
revoke select (djep_ical_url) on public.profiles from authenticated, anon;

-- Own user or admin may read the URL
create or replace function public.get_djep_ical_url(target_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return null;
  end if;

  if auth.uid() = target_id or public.is_admin() then
    return (
      select p.djep_ical_url
      from public.profiles p
      where p.id = target_id
    );
  end if;

  return null;
end;
$$;

revoke all on function public.get_djep_ical_url(uuid) from public;
grant execute on function public.get_djep_ical_url(uuid) to authenticated;

-- Own user or admin may check whether a feed is configured (no URL returned)
create or replace function public.has_djep_ical_url(target_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if auth.uid() = target_id or public.is_admin() then
    return exists (
      select 1
      from public.profiles p
      where p.id = target_id
        and coalesce(nullif(trim(p.djep_ical_url), ''), null) is not null
    );
  end if;

  return false;
end;
$$;

revoke all on function public.has_djep_ical_url(uuid) from public;
grant execute on function public.has_djep_ical_url(uuid) to authenticated;
