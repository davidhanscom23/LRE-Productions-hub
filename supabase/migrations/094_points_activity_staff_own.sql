-- Hub points Activity: staff see only their own events.
-- Admins see everyone. Trainers see everyone except award_excluded (David).
-- Removes the points_log_public() path that exposed the full team ledger to staff.

drop policy if exists "hub_point_events read" on public.hub_point_events;
create policy "hub_point_events read"
  on public.hub_point_events for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      public.current_user_role() = 'trainer'
      and not exists (
        select 1
        from public.profiles p
        where p.id = hub_point_events.user_id
          and coalesce(p.award_excluded, false) = true
      )
    )
  );

comment on function public.points_log_public() is
  'Deprecated: full team Activity is admin/trainer only. Staff always read own rows via RLS.';
