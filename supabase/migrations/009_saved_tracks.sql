-- Personal saved tracks for Music Charts → My Tracks
-- Each user manages their own list

create table public.saved_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  artist text not null default '',
  notes text not null default '',
  url text not null default '',
  created_at timestamptz not null default now()
);

create index saved_tracks_user_id_idx on public.saved_tracks (user_id);
create index saved_tracks_created_at_idx on public.saved_tracks (created_at desc);

alter table public.saved_tracks enable row level security;

create policy "Users can read own saved tracks"
on public.saved_tracks
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own saved tracks"
on public.saved_tracks
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own saved tracks"
on public.saved_tracks
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own saved tracks"
on public.saved_tracks
for delete
to authenticated
using (user_id = auth.uid());
