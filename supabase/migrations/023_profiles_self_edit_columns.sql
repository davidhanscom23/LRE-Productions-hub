-- Restrict non-admin self-updates on profiles to phone, avatar_url, bio,
-- theme_preference, and updated_at. Admins may still update any column.

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
  then
    raise exception 'You can only update your phone, avatar URL, and bio';
  end if;

  -- djep_ical_url may not exist on older DBs; guard via to_jsonb
  if to_jsonb(new) ? 'djep_ical_url'
    and to_jsonb(old) ? 'djep_ical_url'
    and (to_jsonb(new) -> 'djep_ical_url') is distinct from (to_jsonb(old) -> 'djep_ical_url')
  then
    raise exception 'You can only update your phone, avatar URL, and bio';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_self_edit_columns on public.profiles;

create trigger profiles_enforce_self_edit_columns
before update on public.profiles
for each row execute function public.enforce_profile_self_edit_columns();

comment on function public.enforce_profile_self_edit_columns() is
  'Non-admins may only change phone, avatar_url, bio (and theme_preference) on their own profile.';
