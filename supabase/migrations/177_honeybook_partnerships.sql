-- HoneyBook board: Partnerships (venue / vendor deals that are not events).
-- Partnerships are ordinary honeybook_projects rows with record_type = 'partnership'.
-- Money lives in a separate admin-only table so staff cannot read it, even through the API.

alter table public.honeybook_projects
  add column if not exists record_type text not null default 'event',
  add column if not exists partner_kind text not null default '';

alter table public.honeybook_projects
  drop constraint if exists honeybook_projects_record_type_check;
alter table public.honeybook_projects
  add constraint honeybook_projects_record_type_check
  check (record_type in ('event', 'partnership'));

create index if not exists honeybook_projects_record_type_idx
  on public.honeybook_projects (record_type);

comment on column public.honeybook_projects.record_type is
  'event = a client event (default); partnership = a venue/vendor partnership tracked on the Partnerships tab.';
comment on column public.honeybook_projects.partner_kind is
  'For partnerships: Venue, Vendor, or Other.';

create table if not exists public.honeybook_partnership_financials (
  project_id      uuid primary key references public.honeybook_projects (id) on delete cascade,
  deal_value      numeric(12, 2),
  financial_notes text not null default '',
  updated_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now()
);

comment on table public.honeybook_partnership_financials is
  'Admin-only money details for a partnership (deal value, terms). Staff and Leads cannot read this table.';

alter table public.honeybook_partnership_financials enable row level security;

drop policy if exists "partnership financials admin all"
  on public.honeybook_partnership_financials;
create policy "partnership financials admin all"
  on public.honeybook_partnership_financials for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.honeybook_partnership_financials to authenticated;
grant select, insert, update, delete on public.honeybook_partnership_financials to service_role;
