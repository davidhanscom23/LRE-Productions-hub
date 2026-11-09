-- Restrictive guest denials for tables created after migration 042.
-- Same pattern as 042: guests are authenticated, so permissive policies alone are not enough.

do $$
declare
  tbl text;
  tables text[] := array[
    -- P0 sensitive
    'expense_requests',
    'hub_achievements',
    'hub_point_balances',
    'hub_user_achievements',
    'hub_point_events',
    'hub_daily_checkins',
    'hub_foryou_streaks',
    'hub_monthly_awards',
    'hub_foryou_dismissals',
    'performance_reviews',
    'review_cycles',
    'hiring_applications',
    'job_openings',
    'candidates',
    'onboarding_plans',
    'onboarding_items',
    -- P1
    'djep_event_planning',
    'djep_sync_requests',
    'time_off_requests',
    'staff_availability',
    'plaud_meetings',
    'post_comments',
    -- P2 / defense in depth
    'action_items',
    'announcements',
    'announcement_acks',
    'kudos',
    'polls',
    'poll_options',
    'poll_votes',
    'pinterest_boards',
    'home_shortcuts',
    'notification_mutes',
    'push_subscriptions',
    'zoom_huddles',
    'event_external_reviews',
    'hub_documents',
    'hub_document_acknowledgements'
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
