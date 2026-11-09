-- 131 Action Center: multiple assignees with per-person check-offs, plus task comments.
--
-- Each task can now be assigned to several people. Every assignee has their own
-- check-off; the task flips to done when everyone has checked theirs. The legacy
-- action_items.assigned_to column stays populated with the first assignee so
-- older queries keep working during rollout.

-- 1) Assignees ---------------------------------------------------------------

create table if not exists public.action_item_assignees (
  action_id  uuid not null references public.action_items(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  done_at    timestamptz,
  created_at timestamptz not null default now(),
  primary key (action_id, user_id)
);

create index if not exists action_item_assignees_user_idx
  on public.action_item_assignees (user_id);

alter table public.action_item_assignees enable row level security;

drop policy if exists "action_assignees read (authenticated)" on public.action_item_assignees;
create policy "action_assignees read (authenticated)"
  on public.action_item_assignees for select to authenticated using (true);

drop policy if exists "action_assignees insert creator or admin" on public.action_item_assignees;
create policy "action_assignees insert creator or admin"
  on public.action_item_assignees for insert to authenticated
  with check (
    exists (
      select 1 from public.action_items i
      where i.id = action_id
        and (i.created_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "action_assignees delete creator or admin" on public.action_item_assignees;
create policy "action_assignees delete creator or admin"
  on public.action_item_assignees for delete to authenticated
  using (
    exists (
      select 1 from public.action_items i
      where i.id = action_id
        and (i.created_by = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "action_assignees update own or manager" on public.action_item_assignees;
create policy "action_assignees update own or manager"
  on public.action_item_assignees for update to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.action_items i
      where i.id = action_id
        and (i.created_by = auth.uid() or public.is_admin())
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.action_items i
      where i.id = action_id
        and (i.created_by = auth.uid() or public.is_admin())
    )
  );

grant select, insert, update, delete on public.action_item_assignees to authenticated;

-- Backfill the single assignee each existing task already has.
insert into public.action_item_assignees (action_id, user_id, done_at)
select id, assigned_to, case when status = 'done' then coalesce(completed_at, updated_at) end
from public.action_items
where assigned_to is not null
on conflict (action_id, user_id) do nothing;

-- Assignees (via the junction) may update the task row, e.g. flip it to done.
drop policy if exists "action_items update involved or admin" on public.action_items;
create policy "action_items update involved or admin"
  on public.action_items for update to authenticated
  using (
    created_by = auth.uid() or assigned_to = auth.uid() or public.is_admin()
    or exists (
      select 1 from public.action_item_assignees a
      where a.action_id = id and a.user_id = auth.uid()
    )
  )
  with check (
    created_by = auth.uid() or assigned_to = auth.uid() or public.is_admin()
    or exists (
      select 1 from public.action_item_assignees a
      where a.action_id = id and a.user_id = auth.uid()
    )
  );

-- 2) Comments ----------------------------------------------------------------

create table if not exists public.action_item_comments (
  id         uuid primary key default gen_random_uuid(),
  action_id  uuid not null references public.action_items(id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint action_item_comments_body_not_blank check (char_length(trim(body)) > 0)
);

create index if not exists action_item_comments_action_idx
  on public.action_item_comments (action_id, created_at);

alter table public.action_item_comments enable row level security;

drop policy if exists "action_comments read (authenticated)" on public.action_item_comments;
create policy "action_comments read (authenticated)"
  on public.action_item_comments for select to authenticated using (true);

-- Creator, assignees, or admins may comment.
drop policy if exists "action_comments insert involved" on public.action_item_comments;
create policy "action_comments insert involved"
  on public.action_item_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.action_items i
      where i.id = action_id
        and (
          i.created_by = auth.uid()
          or public.is_admin()
          or exists (
            select 1 from public.action_item_assignees a
            where a.action_id = i.id and a.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "action_comments delete own or admin" on public.action_item_comments;
create policy "action_comments delete own or admin"
  on public.action_item_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

grant select, insert, delete on public.action_item_comments to authenticated;

-- 3) Notification helpers (SECURITY DEFINER: non-admins can't insert
--    hub_notifications rows for other users directly) ------------------------

-- Notify a set of newly-assigned users. Caller must be the task creator or admin.
create or replace function public.notify_action_assignees(p_action_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.action_items%rowtype;
  creator text;
  uid uuid;
begin
  select * into item from public.action_items where id = p_action_id;
  if not found then return; end if;
  if item.created_by <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select full_name into creator from public.profiles where id = auth.uid();

  for uid in
    select a.user_id from public.action_item_assignees a
    where a.action_id = p_action_id
      and a.user_id = any(p_user_ids)
      and a.user_id <> auth.uid()
  loop
    insert into public.hub_notifications (user_id, kind, title, body, href)
    values (
      uid,
      'action',
      'New task assigned to you',
      coalesce(nullif(creator, ''), 'Someone') || ' assigned you: ' || item.title,
      '/action-center?item=' || p_action_id
    );
  end loop;
end;
$$;

grant execute on function public.notify_action_assignees(uuid, uuid[]) to authenticated;

-- Notify creator + assignees (except the author) about a new comment.
-- Caller must be the creator, an assignee, or an admin.
create or replace function public.notify_action_comment(p_action_id uuid, p_snippet text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.action_items%rowtype;
  commenter text;
  uid uuid;
begin
  select * into item from public.action_items where id = p_action_id;
  if not found then return; end if;
  if item.created_by <> auth.uid()
     and not public.is_admin()
     and not exists (
       select 1 from public.action_item_assignees a
       where a.action_id = p_action_id and a.user_id = auth.uid()
     )
  then
    raise exception 'Not allowed';
  end if;

  select full_name into commenter from public.profiles where id = auth.uid();

  for uid in
    select distinct t.u from (
      select item.created_by as u
      union
      select a.user_id from public.action_item_assignees a
      where a.action_id = p_action_id
    ) t
    where t.u is not null and t.u <> auth.uid()
  loop
    insert into public.hub_notifications (user_id, kind, title, body, href)
    values (
      uid,
      'action_comment',
      'New comment on: ' || item.title,
      coalesce(nullif(commenter, ''), 'Someone') || ': ' || coalesce(nullif(left(p_snippet, 140), ''), '(comment)'),
      '/action-center?item=' || p_action_id
    );
  end loop;
end;
$$;

grant execute on function public.notify_action_comment(uuid, text) to authenticated;

-- Tell the creator the task is fully completed. Caller must be involved.
create or replace function public.notify_action_completed(p_action_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.action_items%rowtype;
  completer text;
begin
  select * into item from public.action_items where id = p_action_id;
  if not found or item.status <> 'done' then return; end if;
  if item.created_by <> auth.uid()
     and not public.is_admin()
     and not exists (
       select 1 from public.action_item_assignees a
       where a.action_id = p_action_id and a.user_id = auth.uid()
     )
  then
    raise exception 'Not allowed';
  end if;
  if item.created_by = auth.uid() then return; end if;

  select full_name into completer from public.profiles where id = auth.uid();

  insert into public.hub_notifications (user_id, kind, title, body, href)
  values (
    item.created_by,
    'action',
    'Task completed',
    coalesce(nullif(completer, ''), 'Someone') || ' completed: ' || item.title,
    '/action-center?item=' || p_action_id
  );
end;
$$;

grant execute on function public.notify_action_completed(uuid) to authenticated;
