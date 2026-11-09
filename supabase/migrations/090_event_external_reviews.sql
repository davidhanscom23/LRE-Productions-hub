-- Website / spreadsheet testimonials linked to Event Packets by DJEP Event_ID.

create table if not exists public.event_external_reviews (
  id uuid primary key default gen_random_uuid(),
  sheet_fingerprint text not null unique,
  sheet_row integer,
  event_id text,
  calendar_uid text,
  reviewer_name text not null default '',
  comment text not null default '',
  rating integer
    check (rating is null or (rating >= 1 and rating <= 5)),
  review_date date,
  event_type text not null default '',
  services text not null default '',
  staff_members text not null default '',
  show_on_site boolean,
  needs_review boolean,
  source text not null default 'google_sheet',
  matched_packet_count integer not null default 0,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.event_external_reviews is
  'Client testimonials synced from the website Google Sheet, matched to packets via DJEP Event_ID → calendar_uid.';
comment on column public.event_external_reviews.sheet_fingerprint is
  'Stable hash of Name|Date|Comment for idempotent upserts when Event_ID is filled later.';
comment on column public.event_external_reviews.event_id is
  'Numeric DJEP event id from the sheet (digits only).';
comment on column public.event_external_reviews.calendar_uid is
  'Normalized EVENTID:{digits} when event_id is set.';

create index if not exists event_external_reviews_calendar_uid_idx
  on public.event_external_reviews (calendar_uid)
  where calendar_uid is not null;

create index if not exists event_external_reviews_event_id_idx
  on public.event_external_reviews (event_id)
  where event_id is not null;

alter table public.event_external_reviews enable row level security;

drop policy if exists "Authenticated users can read event external reviews"
  on public.event_external_reviews;
create policy "Authenticated users can read event external reviews"
  on public.event_external_reviews
  for select
  to authenticated
  using (public.current_user_role() is distinct from 'guest');

drop policy if exists "Admins can write event external reviews"
  on public.event_external_reviews;
create policy "Admins can write event external reviews"
  on public.event_external_reviews
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.event_external_reviews to authenticated;
