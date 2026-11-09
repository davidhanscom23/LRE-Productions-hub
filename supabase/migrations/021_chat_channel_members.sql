-- Chat channel membership: admins choose who can see and participate.
-- Public channels (is_private = false) stay open to every signed-in user.
-- Private channels require a row in channel_members (admins always have access).

alter table public.channels
  add column if not exists is_private boolean not null default false;

comment on column public.channels.is_private is
  'When true, only listed channel_members (plus admins) can see and post. When false, everyone signed in can.';

create table if not exists public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  primary key (channel_id, user_id)
);

create index if not exists channel_members_user_id_idx
  on public.channel_members (user_id);

comment on table public.channel_members is
  'People allowed in a private chat channel. Managed by admins.';

-- Access helper (security definer so it can read channels/members under RLS).
create or replace function public.can_access_channel(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.channels c
      where c.id = cid
        and (
          c.is_private = false
          or exists (
            select 1
            from public.channel_members m
            where m.channel_id = c.id
              and m.user_id = auth.uid()
          )
        )
    );
$$;

revoke all on function public.can_access_channel(uuid) from public;
grant execute on function public.can_access_channel(uuid) to authenticated;

-- Replace open channel SELECT with membership-aware policy.
drop policy if exists "Authenticated users can read channels" on public.channels;

create policy "Users can read accessible channels"
on public.channels
for select
to authenticated
using (public.can_access_channel(id));

-- Replace open message SELECT / INSERT with membership-aware policies.
drop policy if exists "Authenticated users can read messages" on public.messages;
drop policy if exists "Authenticated users can insert own messages" on public.messages;

create policy "Users can read messages in accessible channels"
on public.messages
for select
to authenticated
using (public.can_access_channel(channel_id));

create policy "Users can insert own messages in accessible channels"
on public.messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_access_channel(channel_id)
);

-- channel_members RLS
alter table public.channel_members enable row level security;

drop policy if exists "Admins can read channel members" on public.channel_members;
drop policy if exists "Users can read own channel membership" on public.channel_members;
drop policy if exists "Admins can insert channel members" on public.channel_members;
drop policy if exists "Admins can delete channel members" on public.channel_members;

create policy "Admins can read channel members"
on public.channel_members
for select
to authenticated
using (public.is_admin());

create policy "Users can read own channel membership"
on public.channel_members
for select
to authenticated
using (user_id = auth.uid());

create policy "Admins can insert channel members"
on public.channel_members
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can delete channel members"
on public.channel_members
for delete
to authenticated
using (public.is_admin());

-- Keep #general company-wide.
update public.channels
set is_private = false
where name = 'general';

comment on table public.channels is
  'Team chat channels. Admins create/rename/delete and assign private-channel members.';
