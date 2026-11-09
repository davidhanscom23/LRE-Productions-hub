-- 139: AV event portals. One private, link-only planning portal per booked AV
-- show (/portal/[token]). Clients (no login) upload the show-day essentials;
-- the hub checks items off, tracks readiness, and sends scheduled check-in
-- emails at 30 / 14 / 7 / 3 days out.
--
-- Access model: RLS is on and there are deliberately NO anon/authenticated
-- policies. The public page and staff screens read/write through the
-- server-side service-role client after their own permission checks. The
-- storage bucket is private; uploads use server-issued signed upload URLs.

create table if not exists public.av_event_portals (
  id                      uuid primary key default gen_random_uuid(),
  token                   text not null unique,
  show_seq                bigint generated always as identity,
  event_name              text not null,
  client_name             text not null default '',
  client_email            text not null,
  cc_emails               text[] not null default '{}',
  event_date              date not null,
  venue_name              text not null default '',
  load_in_time            text not null default '',
  note_to_client          text not null default '',
  is_active               boolean not null default true,
  last_client_activity_at timestamptz,
  completed_at            timestamptz,
  created_by              uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint av_event_portals_name_not_blank check (char_length(trim(event_name)) > 0)
);
create index if not exists av_event_portals_date_idx
  on public.av_event_portals (event_date);

create table if not exists public.av_event_portal_values (
  portal_id   uuid not null references public.av_event_portals(id) on delete cascade,
  item_key    text not null check (item_key in ('headcount','day_of_contact','load_in')),
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (portal_id, item_key)
);

create table if not exists public.av_event_portal_files (
  id            uuid primary key default gen_random_uuid(),
  portal_id     uuid not null references public.av_event_portals(id) on delete cascade,
  item_key      text not null check (item_key in
                  ('floor_plan','run_of_show','load_in','presentation','other')),
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text not null default '',
  size_bytes    bigint not null default 0,
  matched_by    text not null default 'client' check (matched_by in ('client','auto','staff')),
  created_at    timestamptz not null default now()
);
create index if not exists av_event_portal_files_portal_idx
  on public.av_event_portal_files (portal_id);

create table if not exists public.av_event_portal_emails (
  id          uuid primary key default gen_random_uuid(),
  portal_id   uuid not null references public.av_event_portals(id) on delete cascade,
  kind        text not null check (kind in ('d30','d14','d7','d3','complete','manual')),
  recipients  text[] not null default '{}',
  sent_at     timestamptz not null default now()
);
-- Each scheduled check-in (and the all-set thank-you) goes out once per show.
create unique index if not exists av_event_portal_emails_once
  on public.av_event_portal_emails (portal_id, kind) where kind <> 'manual';

drop trigger if exists av_event_portals_updated_at on public.av_event_portals;
create trigger av_event_portals_updated_at
  before update on public.av_event_portals
  for each row execute function public.set_updated_at();

alter table public.av_event_portals enable row level security;
alter table public.av_event_portal_values enable row level security;
alter table public.av_event_portal_files enable row level security;
alter table public.av_event_portal_emails enable row level security;

-- Private bucket for client uploads (floor plans, run of show, slides...).
insert into storage.buckets (id, name, public, file_size_limit)
values ('av-portal-files', 'av-portal-files', false, 52428800) -- 50 MB
on conflict (id) do nothing;
