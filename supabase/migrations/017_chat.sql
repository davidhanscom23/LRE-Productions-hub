-- Internal team chat: channels + messages with Realtime

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  constraint channels_name_not_blank check (char_length(trim(name)) > 0)
);

create index channels_created_at_idx on public.channels (created_at);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_not_blank check (char_length(trim(body)) > 0)
);

create index messages_channel_created_at_idx
  on public.messages (channel_id, created_at);

create index messages_user_id_idx on public.messages (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — channels
-- ---------------------------------------------------------------------------

alter table public.channels enable row level security;

create policy "Authenticated users can read channels"
on public.channels
for select
to authenticated
using (true);

create policy "Admins can create channels"
on public.channels
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update channels"
on public.channels
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete channels"
on public.channels
for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Row Level Security — messages
-- ---------------------------------------------------------------------------

alter table public.messages enable row level security;

create policy "Authenticated users can read messages"
on public.messages
for select
to authenticated
using (true);

create policy "Authenticated users can insert own messages"
on public.messages
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Authors and admins can delete messages"
on public.messages
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- Realtime: live inserts/deletes for the active channel
alter table public.messages replica identity full;

alter publication supabase_realtime add table public.messages;

insert into public.channels (name, description, created_by)
values ('general', 'Company-wide chat for the whole team', null)
on conflict (name) do nothing;

comment on table public.channels is
  'Team chat channels. Admins create/rename/delete; everyone can read.';

comment on table public.messages is
  'Chat messages. Any signed-in user can post; author or admin can delete. Realtime-enabled.';
