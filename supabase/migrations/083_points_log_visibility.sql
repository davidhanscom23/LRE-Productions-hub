-- Hub points activity log visibility (app_settings + RLS).
-- Default when unset = admins-only. Home leaderboard (hub_point_balances) untouched.

create or replace function public.points_log_public()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select value
      from public.app_settings
      where key = 'points_log_visibility'
    ),
    'admins'
  ) = 'everyone';
$$;

grant execute on function public.points_log_public() to authenticated;

drop policy if exists "hub_point_events read own or admin" on public.hub_point_events;
drop policy if exists "hub_point_events read" on public.hub_point_events;
create policy "hub_point_events read"
  on public.hub_point_events for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.points_log_public()
  );
