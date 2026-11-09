-- Venue masters + aliases, event packets (calendar-driven), and richer event_media tags.

-- ---------------------------------------------------------------------------
-- Venues (master folders)
-- ---------------------------------------------------------------------------

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  folder_slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_name_unique unique (name),
  constraint venues_folder_slug_unique unique (folder_slug)
);

create table public.venue_aliases (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  constraint venue_aliases_alias_unique unique (alias)
);

create index venue_aliases_venue_id_idx on public.venue_aliases (venue_id);

-- ---------------------------------------------------------------------------
-- Event packets (one per assigned staff member per calendar event)
-- ---------------------------------------------------------------------------

create table public.event_packets (
  id uuid primary key default gen_random_uuid(),
  calendar_uid text,
  assignee_id uuid not null references public.profiles (id) on delete cascade,
  event_date date not null,
  client_name text not null default '',
  venue_raw text not null default '',
  venue_id uuid references public.venues (id) on delete set null,
  event_type text not null default 'Other',
  dj_name text not null default '',
  status text not null default 'needs_completion'
    check (status in ('needs_completion', 'in_progress', 'completed')),
  memorable_moment text not null default '',
  hours_worked text not null default '',
  equipment_notes text not null default '',
  issues text not null default '',
  client_feedback text not null default '',
  rating integer
    check (rating is null or (rating >= 1 and rating <= 5)),
  follow_up_needed boolean not null default false,
  follow_up_notes text not null default '',
  event_report_id uuid references public.event_reports (id) on delete set null,
  folder_name text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_packets_calendar_assignee_unique unique (calendar_uid, assignee_id)
);

create index event_packets_assignee_id_idx on public.event_packets (assignee_id);
create index event_packets_event_date_idx on public.event_packets (event_date desc);
create index event_packets_status_idx on public.event_packets (status);
create index event_packets_venue_id_idx on public.event_packets (venue_id);

-- ---------------------------------------------------------------------------
-- event_media: create if missing (app already used it), then tag columns
-- ---------------------------------------------------------------------------

create table if not exists public.event_media (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  event_name text not null default '',
  event_date date not null,
  storage_path text not null,
  file_name text not null default '',
  media_type text not null default 'other',
  created_at timestamptz not null default now()
);

alter table public.event_media
  add column if not exists packet_id uuid references public.event_packets (id) on delete set null,
  add column if not exists venue_id uuid references public.venues (id) on delete set null,
  add column if not exists dj_name text not null default '',
  add column if not exists location_name text not null default '',
  add column if not exists client_name text not null default '',
  add column if not exists event_type text not null default '',
  add column if not exists original_file_name text not null default '',
  add column if not exists sequence_number integer,
  add column if not exists folder_path text not null default '';

create index if not exists event_media_uploader_id_idx on public.event_media (uploader_id);
create index if not exists event_media_event_date_idx on public.event_media (event_date desc);
create index if not exists event_media_packet_id_idx on public.event_media (packet_id);
create index if not exists event_media_venue_id_idx on public.event_media (venue_id);
create index if not exists event_media_folder_path_idx on public.event_media (folder_path);

-- ---------------------------------------------------------------------------
-- RLS: venues
-- ---------------------------------------------------------------------------

alter table public.venues enable row level security;
alter table public.venue_aliases enable row level security;

create policy "Authenticated can read venues"
on public.venues for select to authenticated
using (true);

create policy "Admins manage venues insert"
on public.venues for insert to authenticated
with check (public.is_admin());

create policy "Admins manage venues update"
on public.venues for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins manage venues delete"
on public.venues for delete to authenticated
using (public.is_admin());

create policy "Authenticated can read venue aliases"
on public.venue_aliases for select to authenticated
using (true);

create policy "Admins manage venue aliases insert"
on public.venue_aliases for insert to authenticated
with check (public.is_admin());

create policy "Admins manage venue aliases update"
on public.venue_aliases for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins manage venue aliases delete"
on public.venue_aliases for delete to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS: event_packets
-- ---------------------------------------------------------------------------

alter table public.event_packets enable row level security;

create policy "Users read own packets; admin/trainer read all"
on public.event_packets for select to authenticated
using (
  assignee_id = auth.uid()
  or public.current_user_role() in ('admin', 'trainer')
);

create policy "Admins insert packets"
on public.event_packets for insert to authenticated
with check (public.is_admin() or assignee_id = auth.uid());

create policy "Assignee or admin update packets"
on public.event_packets for update to authenticated
using (
  assignee_id = auth.uid()
  or public.is_admin()
)
with check (
  assignee_id = auth.uid()
  or public.is_admin()
);

create policy "Admins delete packets"
on public.event_packets for delete to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- RLS: event_media (idempotent-friendly recreate of common policies)
-- ---------------------------------------------------------------------------

alter table public.event_media enable row level security;

drop policy if exists "Users can read event media" on public.event_media;
drop policy if exists "Users can insert own event media" on public.event_media;
drop policy if exists "Users can delete own event media" on public.event_media;
drop policy if exists "Authors and admins can delete event media" on public.event_media;

create policy "Users can read event media"
on public.event_media for select to authenticated
using (true);

create policy "Users can insert own event media"
on public.event_media for insert to authenticated
with check (uploader_id = auth.uid());

create policy "Authors and admins can update event media"
on public.event_media for update to authenticated
using (uploader_id = auth.uid() or public.is_admin())
with check (uploader_id = auth.uid() or public.is_admin());

create policy "Authors and admins can delete event media"
on public.event_media for delete to authenticated
using (uploader_id = auth.uid() or public.is_admin());

comment on table public.venues is
  'Master venue folders. Event folders nest under these.';
comment on table public.venue_aliases is
  'Alternate venue spellings that resolve to a master venue.';
comment on table public.event_packets is
  'Calendar-driven end-of-event packets assigned to staff for completion.';
