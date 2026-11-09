-- Allow admins to create approved time-off rows for any staffer (Staffing
-- board: mark someone unavailable so it supersedes default-available).
-- Staff can still only insert their own requests.

drop policy if exists "time_off insert own" on public.time_off_requests;
drop policy if exists "time_off insert own or admin" on public.time_off_requests;
create policy "time_off insert own or admin"
  on public.time_off_requests for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());
