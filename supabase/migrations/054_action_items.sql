-- 054 Action Center: shared task board (distinct from personal My Week `tasks`).
-- Anyone can create a task and assign it to a teammate; everyone can see the
-- board; the creator, assignee, or an admin can update/complete it.

create table if not exists public.action_items (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  detail       text not null default '',
  created_by   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  assigned_to  uuid references public.profiles(id) on delete set null,
  due_date     date,
  priority     text not null default 'normal' check (priority in ('low','normal','high')),
  status       text not null default 'open' check (status in ('open','done')),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint action_items_title_not_blank check (char_length(trim(title)) > 0)
);

create index if not exists action_items_assigned_idx on public.action_items (assigned_to);
create index if not exists action_items_status_idx on public.action_items (status);
create index if not exists action_items_created_by_idx on public.action_items (created_by);

alter table public.action_items enable row level security;

drop policy if exists "action_items read (authenticated)" on public.action_items;
create policy "action_items read (authenticated)"
  on public.action_items for select to authenticated using (true);

drop policy if exists "action_items insert own" on public.action_items;
create policy "action_items insert own"
  on public.action_items for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "action_items update involved or admin" on public.action_items;
create policy "action_items update involved or admin"
  on public.action_items for update to authenticated
  using (
    created_by = auth.uid() or assigned_to = auth.uid() or public.is_admin()
  )
  with check (
    created_by = auth.uid() or assigned_to = auth.uid() or public.is_admin()
  );

drop policy if exists "action_items delete creator or admin" on public.action_items;
create policy "action_items delete creator or admin"
  on public.action_items for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.action_items to authenticated;

-- Notify the assignee (SECURITY DEFINER so a non-admin creator can create the
-- notification). Only the task's creator or an admin may trigger it, and only
-- when the assignee is someone other than the caller.
create or replace function public.notify_action_assignee(p_action_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.action_items%rowtype;
  creator text;
begin
  select * into item from public.action_items where id = p_action_id;
  if not found then return; end if;
  if item.created_by <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if item.assigned_to is null or item.assigned_to = auth.uid() then
    return;
  end if;

  select full_name into creator from public.profiles where id = auth.uid();

  insert into public.hub_notifications (user_id, kind, title, body, href)
  values (
    item.assigned_to,
    'action',
    'New task assigned to you',
    coalesce(nullif(creator, ''), 'Someone') || ' assigned you: ' || item.title,
    '/action-center'
  );
end;
$$;

grant execute on function public.notify_action_assignee(uuid) to authenticated;
