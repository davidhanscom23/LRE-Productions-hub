-- 140: AV rental ERP core (KM AV CRM parity — Tier 1 SoR)
-- Catalog, rates, customers, job venues, opportunities (quotes/orders), holds.
-- Prefixed av_* to avoid colliding with event-packet `venues` and future CRM tables.
-- Access: RLS for signed-in staff (admin/trainer/staff). App layer still gates
-- Vident AV to admins + Audiovisual department. No anon policies.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.av_erp_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role()::text in ('admin', 'trainer', 'staff');
$$;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create table if not exists public.av_customers (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  contact_name      text not null default '',
  email             text not null default '',
  phone             text not null default '',
  address_line1     text not null default '',
  address_line2     text not null default '',
  city              text not null default '',
  region            text not null default '',
  postal_code       text not null default '',
  country           text not null default 'US',
  standing_discount_pct numeric(5,2) not null default 0
                      check (standing_discount_pct >= 0 and standing_discount_pct <= 100),
  notes             text not null default '',
  is_quotable       boolean not null default true,
  is_retired        boolean not null default false,
  -- Current RMS member id when imported
  external_rms_id   text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint av_customers_name_not_blank check (char_length(trim(name)) > 0)
);
create unique index if not exists av_customers_rms_id_key
  on public.av_customers (external_rms_id) where external_rms_id is not null;
create index if not exists av_customers_name_idx on public.av_customers (lower(name));

-- ---------------------------------------------------------------------------
-- Job venues (rental ops — separate from event-packet public.venues)
-- ---------------------------------------------------------------------------

create table if not exists public.av_job_venues (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  contact_name      text not null default '',
  email             text not null default '',
  phone             text not null default '',
  address_line1     text not null default '',
  address_line2     text not null default '',
  city              text not null default '',
  region            text not null default '',
  postal_code       text not null default '',
  country           text not null default 'US',
  access_notes      text not null default '',
  power_notes       text not null default '',
  parking_notes     text not null default '',
  notes             text not null default '',
  is_retired        boolean not null default false,
  external_rms_id   text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint av_job_venues_name_not_blank check (char_length(trim(name)) > 0)
);
create unique index if not exists av_job_venues_rms_id_key
  on public.av_job_venues (external_rms_id) where external_rms_id is not null;
create index if not exists av_job_venues_name_idx on public.av_job_venues (lower(name));

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table if not exists public.av_product_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint av_product_groups_name_not_blank check (char_length(trim(name)) > 0)
);
create unique index if not exists av_product_groups_name_key
  on public.av_product_groups (lower(name));

create table if not exists public.av_rate_definitions (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  -- How rental days/hours are charged (KM: Daily, Weekly, Hourly, Flat, 3 Day Week, …)
  charged_mode      text not null default 'daily'
                      check (charged_mode in (
                        'daily', 'weekly', 'monthly', 'hourly', 'flat',
                        'three_day_week', 'daily_capped_4'
                      )),
  day_count_rule    text not null default 'calendar'
                      check (day_count_rule in ('calendar', 'billable_map', 'leeway')),
  leeway_minutes    integer not null default 0 check (leeway_minutes >= 0),
  fewest_units      numeric(8,2) not null default 1 check (fewest_units > 0),
  -- Optional JSON map for modes like 3 Day Week (e.g. {"91":39})
  billable_days_map jsonb not null default '{}'::jsonb,
  is_default        boolean not null default false,
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint av_rate_definitions_name_not_blank check (char_length(trim(name)) > 0)
);
create unique index if not exists av_rate_definitions_name_key
  on public.av_rate_definitions (lower(name));
-- At most one default rate
create unique index if not exists av_rate_definitions_one_default
  on public.av_rate_definitions ((is_default)) where is_default;

create table if not exists public.av_products (
  id                    uuid primary key default gen_random_uuid(),
  group_id              uuid references public.av_product_groups(id) on delete set null,
  name                  text not null,
  code                  text not null default '',
  description           text not null default '',
  -- stocked gear vs package (package holds no stock) vs consumable/sale
  kind                  text not null default 'rental'
                          check (kind in ('rental', 'package', 'sale', 'consumable')),
  rental_price          numeric(12,2) not null default 0 check (rental_price >= 0),
  sale_price            numeric(12,2),
  replacement_charge    numeric(12,2),
  qty_owned             numeric(12,2) not null default 0 check (qty_owned >= 0),
  buffer_pct            numeric(5,2) not null default 0
                          check (buffer_pct >= 0 and buffer_pct <= 100),
  turnaround_hours      integer not null default 0 check (turnaround_hours >= 0),
  weight_lbs            numeric(10,2),
  photo_path            text,
  is_active             boolean not null default true,
  external_rms_id       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint av_products_name_not_blank check (char_length(trim(name)) > 0)
);
create unique index if not exists av_products_rms_id_key
  on public.av_products (external_rms_id) where external_rms_id is not null;
create index if not exists av_products_group_idx on public.av_products (group_id);
create index if not exists av_products_name_idx on public.av_products (lower(name));
create index if not exists av_products_code_idx on public.av_products (code) where code <> '';

create table if not exists public.av_services (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  code              text not null default '',
  description       text not null default '',
  kind              text not null default 'fee'
                      check (kind in ('crew', 'transport', 'fee')),
  unit_price        numeric(12,2) not null default 0 check (unit_price >= 0),
  is_active         boolean not null default true,
  external_rms_id   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint av_services_name_not_blank check (char_length(trim(name)) > 0)
);
create unique index if not exists av_services_rms_id_key
  on public.av_services (external_rms_id) where external_rms_id is not null;
create index if not exists av_services_name_idx on public.av_services (lower(name));

create table if not exists public.av_product_accessories (
  id                  uuid primary key default gen_random_uuid(),
  parent_product_id   uuid not null references public.av_products(id) on delete cascade,
  child_product_id    uuid not null references public.av_products(id) on delete cascade,
  qty                 numeric(12,2) not null default 1 check (qty > 0),
  is_required         boolean not null default false,
  created_at          timestamptz not null default now(),
  constraint av_product_accessories_no_self check (parent_product_id <> child_product_id),
  constraint av_product_accessories_unique unique (parent_product_id, child_product_id)
);

-- ---------------------------------------------------------------------------
-- Opportunities (quotes / orders)
-- ---------------------------------------------------------------------------

create sequence if not exists public.av_opportunity_ref_seq;

create table if not exists public.av_opportunities (
  id                    uuid primary key default gen_random_uuid(),
  -- Display ref e.g. Q-0009 (assigned on insert)
  reference             text not null,
  subject               text not null default '',
  -- KM UI stages (Reservation is holds, not a stage)
  status                text not null default 'draft'
                          check (status in ('draft', 'quotation', 'order', 'closed')),
  customer_id           uuid references public.av_customers(id) on delete set null,
  venue_id              uuid references public.av_job_venues(id) on delete set null,
  rate_definition_id    uuid references public.av_rate_definitions(id) on delete set null,
  -- Dual windows (KM): gear out/back vs charge period
  gear_starts_at        timestamptz,
  gear_ends_at          timestamptz,
  charge_starts_at      timestamptz,
  charge_ends_at        timestamptz,
  bill_whole_event      boolean not null default false,
  surcharge_pct         numeric(5,2) not null default 0
                          check (surcharge_pct >= 0 and surcharge_pct <= 100),
  discount_pct          numeric(5,2) not null default 0
                          check (discount_pct >= 0 and discount_pct <= 100),
  -- Hidden venue markup (customer never sees; staff-only Totals row)
  venue_markup_pct      numeric(5,2) not null default 0
                          check (venue_markup_pct >= 0 and venue_markup_pct <= 100),
  venue_markup_enabled  boolean not null default false,
  transport_notes       text not null default '',
  notes                 text not null default '',
  is_template           boolean not null default false,
  source_opportunity_id uuid references public.av_opportunities(id) on delete set null,
  external_rms_id       text,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint av_opportunities_gear_window check (
    gear_starts_at is null or gear_ends_at is null or gear_ends_at >= gear_starts_at
  ),
  constraint av_opportunities_charge_window check (
    charge_starts_at is null or charge_ends_at is null or charge_ends_at >= charge_starts_at
  )
);
create unique index if not exists av_opportunities_reference_key
  on public.av_opportunities (reference);
create unique index if not exists av_opportunities_rms_id_key
  on public.av_opportunities (external_rms_id) where external_rms_id is not null;
create index if not exists av_opportunities_status_idx on public.av_opportunities (status);
create index if not exists av_opportunities_customer_idx on public.av_opportunities (customer_id);
create index if not exists av_opportunities_gear_starts_idx
  on public.av_opportunities (gear_starts_at);

create or replace function public.av_opportunities_assign_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or trim(new.reference) = '' then
    new.reference := 'Q-' || lpad(nextval('public.av_opportunity_ref_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists av_opportunities_assign_reference on public.av_opportunities;
create trigger av_opportunities_assign_reference
  before insert on public.av_opportunities
  for each row execute function public.av_opportunities_assign_reference();

create table if not exists public.av_opportunity_groups (
  id               uuid primary key default gen_random_uuid(),
  opportunity_id   uuid not null references public.av_opportunities(id) on delete cascade,
  name             text not null default 'Section',
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists av_opportunity_groups_opp_idx
  on public.av_opportunity_groups (opportunity_id, sort_order);

create table if not exists public.av_opportunity_lines (
  id               uuid primary key default gen_random_uuid(),
  opportunity_id   uuid not null references public.av_opportunities(id) on delete cascade,
  group_id         uuid references public.av_opportunity_groups(id) on delete set null,
  parent_line_id   uuid references public.av_opportunity_lines(id) on delete cascade,
  product_id       uuid references public.av_products(id) on delete set null,
  service_id       uuid references public.av_services(id) on delete set null,
  description      text not null default '',
  qty              numeric(12,2) not null default 1 check (qty > 0),
  -- Unit price before venue markup (staff "real" price)
  unit_price       numeric(12,2) not null default 0 check (unit_price >= 0),
  discount_pct     numeric(5,2) not null default 0
                     check (discount_pct >= 0 and discount_pct <= 100),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint av_opportunity_lines_item check (
    product_id is not null or service_id is not null or char_length(trim(description)) > 0
  )
);
create index if not exists av_opportunity_lines_opp_idx
  on public.av_opportunity_lines (opportunity_id, sort_order);
create index if not exists av_opportunity_lines_product_idx
  on public.av_opportunity_lines (product_id);

-- ---------------------------------------------------------------------------
-- Holds (reservations against gear window)
-- ---------------------------------------------------------------------------

create table if not exists public.av_holds (
  id               uuid primary key default gen_random_uuid(),
  opportunity_id   uuid not null references public.av_opportunities(id) on delete cascade,
  line_id          uuid references public.av_opportunity_lines(id) on delete cascade,
  product_id       uuid not null references public.av_products(id) on delete restrict,
  qty              numeric(12,2) not null check (qty > 0),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint av_holds_window check (ends_at >= starts_at)
);
create index if not exists av_holds_product_window_idx
  on public.av_holds (product_id, starts_at, ends_at);
create index if not exists av_holds_opportunity_idx
  on public.av_holds (opportunity_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists av_customers_updated_at on public.av_customers;
create trigger av_customers_updated_at
  before update on public.av_customers
  for each row execute function public.set_updated_at();

drop trigger if exists av_job_venues_updated_at on public.av_job_venues;
create trigger av_job_venues_updated_at
  before update on public.av_job_venues
  for each row execute function public.set_updated_at();

drop trigger if exists av_product_groups_updated_at on public.av_product_groups;
create trigger av_product_groups_updated_at
  before update on public.av_product_groups
  for each row execute function public.set_updated_at();

drop trigger if exists av_rate_definitions_updated_at on public.av_rate_definitions;
create trigger av_rate_definitions_updated_at
  before update on public.av_rate_definitions
  for each row execute function public.set_updated_at();

drop trigger if exists av_products_updated_at on public.av_products;
create trigger av_products_updated_at
  before update on public.av_products
  for each row execute function public.set_updated_at();

drop trigger if exists av_services_updated_at on public.av_services;
create trigger av_services_updated_at
  before update on public.av_services
  for each row execute function public.set_updated_at();

drop trigger if exists av_opportunities_updated_at on public.av_opportunities;
create trigger av_opportunities_updated_at
  before update on public.av_opportunities
  for each row execute function public.set_updated_at();

drop trigger if exists av_opportunity_lines_updated_at on public.av_opportunity_lines;
create trigger av_opportunity_lines_updated_at
  before update on public.av_opportunity_lines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed default rate definitions (KM-like names)
-- ---------------------------------------------------------------------------

insert into public.av_rate_definitions (name, charged_mode, day_count_rule, is_default, sort_order)
select v.name, v.charged_mode, v.day_count_rule, v.is_default, v.sort_order
from (values
  ('Daily', 'daily', 'calendar', true, 1),
  ('Weekly', 'weekly', 'calendar', false, 2),
  ('Monthly', 'monthly', 'calendar', false, 3),
  ('Hourly', 'hourly', 'leeway', false, 4),
  ('Flat', 'flat', 'calendar', false, 5),
  ('3 Day Week', 'three_day_week', 'billable_map', false, 6),
  ('Daily capped at 4 days', 'daily_capped_4', 'calendar', false, 7)
) as v(name, charged_mode, day_count_rule, is_default, sort_order)
where not exists (
  select 1 from public.av_rate_definitions existing
  where lower(existing.name) = lower(v.name)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.av_customers enable row level security;
alter table public.av_job_venues enable row level security;
alter table public.av_product_groups enable row level security;
alter table public.av_rate_definitions enable row level security;
alter table public.av_products enable row level security;
alter table public.av_services enable row level security;
alter table public.av_product_accessories enable row level security;
alter table public.av_opportunities enable row level security;
alter table public.av_opportunity_groups enable row level security;
alter table public.av_opportunity_lines enable row level security;
alter table public.av_holds enable row level security;

-- Staff CRUD (guests blocked). Service role bypasses RLS for imports.

do $$
declare
  t text;
begin
  foreach t in array array[
    'av_customers',
    'av_job_venues',
    'av_product_groups',
    'av_rate_definitions',
    'av_products',
    'av_services',
    'av_product_accessories',
    'av_opportunities',
    'av_opportunity_groups',
    'av_opportunity_lines',
    'av_holds'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.av_erp_is_staff())',
      t || '_staff_select', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_staff_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.av_erp_is_staff())',
      t || '_staff_insert', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_staff_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.av_erp_is_staff()) with check (public.av_erp_is_staff())',
      t || '_staff_update', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_staff_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.av_erp_is_staff())',
      t || '_staff_delete', t
    );
  end loop;
end $$;
