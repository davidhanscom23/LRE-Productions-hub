-- 053 Notify admins of a new time-off request
-- Regular staff can't insert notifications for other users (the hub_notifications
-- insert policy is admin/trainer only). This SECURITY DEFINER function lets a
-- staffer trigger admin notifications for their OWN request only.
create or replace function public.notify_admins_of_time_off(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.time_off_requests%rowtype;
  requester text;
  a record;
begin
  select * into req from public.time_off_requests where id = p_request_id;
  if not found then return; end if;
  if req.user_id <> auth.uid() then raise exception 'Not your request'; end if;

  select full_name into requester from public.profiles where id = req.user_id;

  for a in select id from public.profiles where role = 'admin' loop
    insert into public.hub_notifications (user_id, kind, title, body, href)
    values (
      a.id,
      'time_off',
      'New time-off request',
      coalesce(nullif(requester, ''), 'A staffer') || ' requested '
        || to_char(req.start_date, 'Mon DD')
        || case when req.end_date <> req.start_date
                then ' – ' || to_char(req.end_date, 'Mon DD') else '' end,
      '/time-off'
    );
  end loop;
end;
$$;

grant execute on function public.notify_admins_of_time_off(uuid) to authenticated;
