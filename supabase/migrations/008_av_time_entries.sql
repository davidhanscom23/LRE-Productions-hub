-- AV Time Tracker: clock in/out against events
-- Staff manage their own entries; admins/trainers can read all

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  department text not null
    check (department in ('Audiovisual', 'Corporate', 'Wedding & Social', 'Golf')),
  event_name text not null default '',
  notes text not null default '',
  source text not null default 'manual'
    check (source in ('manual', 'calendar')),
  clocked_in_at timestamptz not null default now(),
  clocked_out_at timestamptz,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create index time_entries_user_id_idx on public.time_entries (user_id);
create index time_entries_department_idx on public.time_entries (department);
create index time_entries_clocked_in_at_idx on public.time_entries (clocked_in_at desc);
create index time_entries_open_idx on public.time_entries (user_id)
  where clocked_out_at is null;

alter table public.time_entries enable row level security;

create policy "Users can read own time entries or all if trainer/admin"
on public.time_entries
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('admin', 'trainer')
);

create policy "Users can insert own time entries"
on public.time_entries
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own time entries"
on public.time_entries
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

create policy "Users can delete own time entries or admin"
on public.time_entries
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);
