-- 063 Staff cannot mute admin-originated notifications.
-- Non-admins may only mute optional kinds (kudos). Admins can mute anything of
-- their own. Enforced in RLS so it holds regardless of the app.

drop policy if exists "notification_mutes own" on public.notification_mutes;
create policy "notification_mutes own"
  on public.notification_mutes for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      public.is_admin()
      or kind not in ('announcement', 'time_off', 'expense', 'review', 'action')
    )
  );

-- Clean up any mandatory-kind mutes currently held by non-admins.
delete from public.notification_mutes m
where m.kind in ('announcement', 'time_off', 'expense', 'review', 'action')
  and not exists (
    select 1 from public.profiles p where p.id = m.user_id and p.role = 'admin'
  );
