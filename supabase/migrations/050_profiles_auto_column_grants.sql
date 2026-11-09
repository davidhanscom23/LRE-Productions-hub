-- 050: Self-maintaining SELECT grants for profiles columns.
--
-- profiles is on column-level privileges (since migration 014 revoked SELECT on
-- djep_ical_url). Every column added afterward had to be granted by hand, or
-- profile selects failed with "permission denied for table profiles" (People +
-- Calendar broke — see 048/049). This event trigger auto-grants SELECT on any
-- future profiles column (except the two locked calendar-URL columns), so it
-- can never recur. Safe to re-run.

create or replace function public.grant_profile_column_selects()
returns event_trigger
language plpgsql
as $$
declare
  cmd record;
  stmt text;
begin
  for cmd in select * from pg_event_trigger_ddl_commands() loop
    if cmd.object_identity = 'public.profiles' then
      select string_agg(
        format(
          'grant select (%I) on public.profiles to authenticated, anon',
          column_name
        ),
        '; '
      )
      into stmt
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name not in ('djep_ical_url', 'personal_ical_url');
      if stmt is not null then
        execute stmt;
      end if;
    end if;
  end loop;
end;
$$;

drop event trigger if exists profiles_auto_grants;
create event trigger profiles_auto_grants
  on ddl_command_end
  when tag in ('ALTER TABLE')
  execute function public.grant_profile_column_selects();

-- Apply once now so current state is fully consistent (idempotent).
do $$
declare stmt text;
begin
  select string_agg(
    format(
      'grant select (%I) on public.profiles to authenticated, anon',
      column_name
    ),
    '; '
  )
  into stmt
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name not in ('djep_ical_url', 'personal_ical_url');
  if stmt is not null then
    execute stmt;
  end if;
end;
$$;
