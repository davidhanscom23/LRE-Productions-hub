-- Social Studio captions + Google Drive backup tracking on event media.

create table public.social_captions (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.event_packets (id) on delete cascade,
  platform text not null
    check (platform in ('facebook', 'instagram', 'linkedin', 'tiktok', 'twitter')),
  caption text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_captions_packet_platform_unique unique (packet_id, platform)
);

create index social_captions_packet_id_idx on public.social_captions (packet_id);

alter table public.event_media
  add column if not exists drive_file_id text,
  add column if not exists drive_synced_at timestamptz;

create table public.drive_folder_cache (
  path text primary key,
  drive_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.social_captions enable row level security;
alter table public.drive_folder_cache enable row level security;

create policy "Users read social captions for visible packets"
on public.social_captions for select to authenticated
using (
  exists (
    select 1 from public.event_packets p
    where p.id = packet_id
      and (
        p.assignee_id = auth.uid()
        or public.current_user_role() in ('admin', 'trainer')
      )
  )
);

create policy "Users upsert social captions for own or admin packets"
on public.social_captions for insert to authenticated
with check (
  exists (
    select 1 from public.event_packets p
    where p.id = packet_id
      and (
        p.assignee_id = auth.uid()
        or public.is_admin()
      )
  )
);

create policy "Users update social captions for own or admin packets"
on public.social_captions for update to authenticated
using (
  exists (
    select 1 from public.event_packets p
    where p.id = packet_id
      and (
        p.assignee_id = auth.uid()
        or public.is_admin()
      )
  )
)
with check (
  exists (
    select 1 from public.event_packets p
    where p.id = packet_id
      and (
        p.assignee_id = auth.uid()
        or public.is_admin()
      )
  )
);

create policy "Admins manage drive folder cache"
on public.drive_folder_cache for all to authenticated
using (public.is_admin())
with check (public.is_admin());

comment on table public.social_captions is
  'Per-platform social captions generated from Event Packets.';
comment on table public.drive_folder_cache is
  'Maps Hub folder_path prefixes to Google Drive folder IDs for backup sync.';
