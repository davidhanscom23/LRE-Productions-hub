-- 1) Hide award_excluded profiles (David) from non-admin Activity log reads.
-- 2) Backfill Hub points for already-submitted End of Event reports.

-- ---------------------------------------------------------------------------
-- Activity privacy: award_excluded only visible to admins (or the person themself)
-- ---------------------------------------------------------------------------

drop policy if exists "hub_point_events read" on public.hub_point_events;
create policy "hub_point_events read"
  on public.hub_point_events for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      public.points_log_public()
      and not exists (
        select 1
        from public.profiles p
        where p.id = hub_point_events.user_id
          and coalesce(p.award_excluded, false) = true
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Backfill EOE report submissions → eoe_report_submitted (unique per report_id)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_result jsonb;
  v_count integer := 0;
  v_label text;
begin
  if not exists (
    select 1 from public.hub_achievements
    where key = 'eoe_report_submitted' and is_active
  ) then
    raise notice 'Skipping EOE backfill — eoe_report_submitted achievement missing (run 077 first).';
    return;
  end if;

  if to_regclass('public.event_reports') is null then
    raise notice 'Skipping EOE backfill — event_reports missing.';
    return;
  end if;

  for r in
    select
      er.id as report_id,
      er.reporter_id as user_id,
      er.client_name,
      er.event_date
    from public.event_reports er
    join public.profiles p on p.id = er.reporter_id
    where p.role is distinct from 'guest'
      and coalesce(p.is_active, true)
  loop
    v_label := coalesce(nullif(trim(r.client_name), ''), 'event');
    v_result := public.award_hub_achievement_for_user(
      r.user_id,
      'eoe_report_submitted',
      jsonb_build_object(
        'backfill', true,
        'source', 'event_reports',
        'report_id', r.report_id::text
      ),
      'Backfill: EOE report — ' || v_label
        || case
          when r.event_date is not null then ' (' || r.event_date::text || ')'
          else ''
        end
    );
    if coalesce((v_result->>'awarded')::boolean, false) then
      v_count := v_count + 1;
    end if;
  end loop;

  raise notice 'EOE report backfill awarded % new grants.', v_count;
end;
$$;
