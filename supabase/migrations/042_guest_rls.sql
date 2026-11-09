-- Guest RLS + helper. Run AFTER 041_guest_role.sql has committed.
-- Safe to re-run.

create or replace function public.is_guest()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role()::text = 'guest', false);
$$;

revoke all on function public.is_guest() from public;
grant execute on function public.is_guest() to authenticated;

-- Profiles: guests may only read their own row (no staff directory dump).
-- Use current_user_role() (security definer) — never subquery profiles in this policy.
drop policy if exists "Authenticated users can read profiles" on public.profiles;

create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (
  public.current_user_role()::text is distinct from 'guest'
  or id = auth.uid()
);

-- Restrictive denials (SELECT/INSERT/UPDATE/DELETE). Skips missing tables.
do $$
declare
  tbl text;
  tables text[] := array[
    'posts',
    'event_reports',
    'department_links',
    'department_videos',
    'time_entries',
    'saved_tracks',
    'onboarding_resources',
    'app_settings',
    'tasks',
    'daily_quote_assignments',
    'channels',
    'messages',
    'channel_members',
    'handbook_acknowledgements',
    'staff_handbook',
    'venues',
    'venue_aliases',
    'event_packets',
    'event_media',
    'social_captions',
    'drive_folder_cache',
    'social_post_drafts',
    'hub_notifications',
    'profile_department_managers',
    'training_lesson_completions'
  ];
  base text;
begin
  foreach tbl in array tables
  loop
    if to_regclass('public.' || tbl) is null then
      raise notice 'skip missing table: %', tbl;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    base := 'guests_denied_' || tbl;

    -- Clean prior attempts (old and new naming).
    -- Policy names are identifiers → use %I (not %L literal quotes).
    execute format(
      'drop policy if exists %I on public.%I',
      'Guests denied on ' || tbl,
      tbl
    );
    execute format('drop policy if exists %I on public.%I', base, tbl);
    execute format('drop policy if exists %I on public.%I', base || '_select', tbl);
    execute format('drop policy if exists %I on public.%I', base || '_insert', tbl);
    execute format('drop policy if exists %I on public.%I', base || '_update', tbl);
    execute format('drop policy if exists %I on public.%I', base || '_delete', tbl);
    execute format('drop policy if exists %I on public.%I', base || '_write', tbl);

    execute format(
      $pol$
        create policy %I on public.%I as restrictive
        for select to authenticated
        using (not public.is_guest())
      $pol$,
      base || '_select', tbl
    );

    execute format(
      $pol$
        create policy %I on public.%I as restrictive
        for insert to authenticated
        with check (not public.is_guest())
      $pol$,
      base || '_insert', tbl
    );

    execute format(
      $pol$
        create policy %I on public.%I as restrictive
        for update to authenticated
        using (not public.is_guest())
        with check (not public.is_guest())
      $pol$,
      base || '_update', tbl
    );

    execute format(
      $pol$
        create policy %I on public.%I as restrictive
        for delete to authenticated
        using (not public.is_guest())
      $pol$,
      base || '_delete', tbl
    );

    raise notice 'guest denials applied: %', tbl;
  end loop;
end $$;
