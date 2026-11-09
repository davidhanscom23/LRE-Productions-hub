-- 059 Kudos / Recognition. Peer shout-outs, optionally tagged with a value.

create table if not exists public.kudos (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  to_user    uuid not null references public.profiles(id) on delete cascade,
  message    text not null default '',
  value      text not null default ''
               check (value in ('','integrity','gratitude','teamwork')),
  created_at timestamptz not null default now(),
  constraint kudos_not_self check (from_user <> to_user),
  constraint kudos_message_not_blank check (char_length(trim(message)) > 0)
);

create index if not exists kudos_to_idx on public.kudos (to_user);
create index if not exists kudos_created_idx on public.kudos (created_at desc);

alter table public.kudos enable row level security;

drop policy if exists "kudos read (authenticated)" on public.kudos;
create policy "kudos read (authenticated)"
  on public.kudos for select to authenticated using (true);

drop policy if exists "kudos insert own" on public.kudos;
create policy "kudos insert own"
  on public.kudos for insert to authenticated
  with check (from_user = auth.uid());

drop policy if exists "kudos delete own or admin" on public.kudos;
create policy "kudos delete own or admin"
  on public.kudos for delete to authenticated
  using (from_user = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.kudos to authenticated;

-- Notify the recipient (SECURITY DEFINER so any staffer can notify a peer for
-- their OWN kudo only).
create or replace function public.notify_kudos_recipient(p_kudo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.kudos%rowtype;
  giver text;
begin
  select * into k from public.kudos where id = p_kudo_id;
  if not found then return; end if;
  if k.from_user <> auth.uid() then raise exception 'Not your kudo'; end if;

  select full_name into giver from public.profiles where id = k.from_user;

  insert into public.hub_notifications (user_id, kind, title, body, href)
  values (
    k.to_user,
    'kudos',
    'You got recognized! 🎉',
    coalesce(nullif(giver, ''), 'A teammate') || ' gave you kudos: ' || left(k.message, 120),
    '/kudos'
  );
end;
$$;

grant execute on function public.notify_kudos_recipient(uuid) to authenticated;
