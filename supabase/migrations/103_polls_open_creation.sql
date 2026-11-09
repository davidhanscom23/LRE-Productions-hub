-- 097 Open poll creation to all staff (admin, trainer, or staff).
-- Anyone signed in (except guests) can create a poll for everyone. The poll's
-- creator, or any admin/trainer, can close or delete it.

-- polls: split the old admin/trainer-only "write" into insert/update/delete.
drop policy if exists "polls write" on public.polls;

drop policy if exists "polls insert" on public.polls;
create policy "polls insert" on public.polls for insert to authenticated
  with check (created_by = auth.uid() and public.current_user_role() <> 'guest');

drop policy if exists "polls update" on public.polls;
create policy "polls update" on public.polls for update to authenticated
  using (public.current_user_role() in ('admin','trainer') or created_by = auth.uid())
  with check (public.current_user_role() in ('admin','trainer') or created_by = auth.uid());

drop policy if exists "polls delete" on public.polls;
create policy "polls delete" on public.polls for delete to authenticated
  using (public.current_user_role() in ('admin','trainer') or created_by = auth.uid());

-- poll_options: manageable by the parent poll's creator or an admin/trainer.
drop policy if exists "poll_options write" on public.poll_options;

drop policy if exists "poll_options manage" on public.poll_options;
create policy "poll_options manage" on public.poll_options for all to authenticated
  using (
    exists (
      select 1 from public.polls p
      where p.id = poll_id
        and (p.created_by = auth.uid()
             or public.current_user_role() in ('admin','trainer'))
    )
  )
  with check (
    exists (
      select 1 from public.polls p
      where p.id = poll_id
        and (p.created_by = auth.uid()
             or public.current_user_role() in ('admin','trainer'))
    )
  );

-- Let a poll's creator notify the whole team, even if they're not an admin.
-- (SECURITY DEFINER so staff can insert notifications for peers for THEIR poll.)
create or replace function public.notify_new_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.polls%rowtype;
begin
  select * into p from public.polls where id = p_poll_id;
  if not found then return; end if;
  if p.created_by <> auth.uid() then
    raise exception 'Not your poll';
  end if;

  insert into public.hub_notifications (user_id, kind, title, body, href)
  select pr.id, 'poll', 'New team poll', left(p.question, 200), '/polls'
  from public.profiles pr
  where pr.is_active = true
    and pr.role <> 'guest'
    and pr.id <> p.created_by;
end;
$$;

grant execute on function public.notify_new_poll(uuid) to authenticated;
