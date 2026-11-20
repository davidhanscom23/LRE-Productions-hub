-- Gear tags: QR asset tags on individual pieces of gear, scanned to check out / check in.
-- One tag = one row in av_product_units. Scans are logged in gear_tag_scans and also tick the
-- event's gear checklist. Staff suggestions wait in gear_change_requests for an admin.

-- ---------------------------------------------------------------------------
-- 1. Tag fields on each physical piece
-- ---------------------------------------------------------------------------
alter table public.av_product_units
  add column if not exists tag_number     text,
  add column if not exists label          text not null default '',
  add column if not exists is_case        boolean not null default false,
  add column if not exists case_unit_id   uuid references public.av_product_units (id) on delete set null,
  add column if not exists tagged_at      timestamptz,
  add column if not exists tagged_by      uuid references public.profiles (id) on delete set null,
  add column if not exists out_project_id uuid references public.pipeline_projects (id) on delete set null,
  add column if not exists out_since      timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'av_product_units_tag_format'
  ) then
    alter table public.av_product_units
      add constraint av_product_units_tag_format
      check (tag_number is null or tag_number ~ '^[0-9]{4,6}$');
  end if;
end $$;

create unique index if not exists av_product_units_tag_uidx
  on public.av_product_units (tag_number) where tag_number is not null;
create index if not exists av_product_units_case_idx
  on public.av_product_units (case_unit_id) where case_unit_id is not null;
create index if not exists av_product_units_out_project_idx
  on public.av_product_units (out_project_id) where out_project_id is not null;

comment on column public.av_product_units.tag_number is
  'Number printed on the LRE Productions asset tag (4 to 6 digits). Never reused.';
comment on column public.av_product_units.label is
  'Short name for this one piece, for example "Speaker 3".';
comment on column public.av_product_units.is_case is
  'True when this tag is on a case, rack or bin. Scanning it moves every piece assigned to it.';
comment on column public.av_product_units.case_unit_id is
  'The case this piece lives in, when it has one.';
comment on column public.av_product_units.out_project_id is
  'Event this piece is currently out to (null when it is in, or out with no event).';

-- ---------------------------------------------------------------------------
-- 2. Who may read: admins, Leads and staff (never guests)
-- ---------------------------------------------------------------------------
create or replace function public.gear_tag_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role()::text in ('admin', 'trainer', 'staff');
$$;

grant execute on function public.gear_tag_is_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Scan log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.gear_tag_scans (
  id                uuid primary key default gen_random_uuid(),
  unit_id           uuid not null references public.av_product_units (id) on delete cascade,
  tag_number        text,
  direction         text not null check (direction in ('out', 'back')),
  project_id        uuid references public.pipeline_projects (id) on delete set null,
  -- Set when the piece moved because its case was scanned.
  via_case_unit_id  uuid references public.av_product_units (id) on delete set null,
  flag              text not null default 'none' check (flag in ('none', 'damaged', 'missing')),
  note              text not null default '',
  scanned_by        uuid references public.profiles (id) on delete set null,
  scanned_at        timestamptz not null default now(),
  -- Set by the phone so a replayed offline scan never double-counts.
  client_id         text,
  -- Snapshot so history stays readable if the piece, product or event changes later.
  product_name      text not null default '',
  unit_label        text not null default '',
  project_name      text not null default '',
  created_at        timestamptz not null default now()
);

create unique index if not exists gear_tag_scans_client_uidx
  on public.gear_tag_scans (client_id) where client_id is not null;
create index if not exists gear_tag_scans_unit_idx
  on public.gear_tag_scans (unit_id, scanned_at desc);
create index if not exists gear_tag_scans_project_idx
  on public.gear_tag_scans (project_id, scanned_at desc) where project_id is not null;

comment on table public.gear_tag_scans is
  'Append-only history of every gear tag scan (check out / check in), one row per piece moved.';

alter table public.gear_tag_scans enable row level security;

drop policy if exists "gear tag scans staff read" on public.gear_tag_scans;
create policy "gear tag scans staff read" on public.gear_tag_scans for select to authenticated
  using (public.gear_tag_is_staff());

-- No insert/update/delete policy: the Hub writes scans on the server after checking the role.
grant select on public.gear_tag_scans to authenticated;
grant select, insert, update, delete on public.gear_tag_scans to service_role;

-- ---------------------------------------------------------------------------
-- 4. Staff suggestions that an admin approves or declines
-- ---------------------------------------------------------------------------
create table if not exists public.gear_change_requests (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('link_tag', 'add', 'change', 'remove')),
  tag_number    text,
  unit_id       uuid references public.av_product_units (id) on delete set null,
  product_id    uuid references public.av_products (id) on delete set null,
  -- For link_tag: { productId, label, serial, isCase, caseTag, owner }.
  payload       jsonb not null default '{}'::jsonb,
  details       text not null default '',
  status        text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_by  uuid references public.profiles (id) on delete set null,
  requested_at  timestamptz not null default now(),
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text not null default ''
);

create index if not exists gear_change_requests_status_idx
  on public.gear_change_requests (status, requested_at desc);
create index if not exists gear_change_requests_requester_idx
  on public.gear_change_requests (requested_by, requested_at desc);

comment on table public.gear_change_requests is
  'Staff suggestions about tagged gear (link a tag, add, change, remove). Only an admin can approve.';

alter table public.gear_change_requests enable row level security;

drop policy if exists "gear change requests read" on public.gear_change_requests;
create policy "gear change requests read" on public.gear_change_requests for select to authenticated
  using (
    public.current_user_role()::text = 'admin'
    or requested_by = auth.uid()
  );

grant select on public.gear_change_requests to authenticated;
grant select, insert, update, delete on public.gear_change_requests to service_role;
