-- KM Missing/Partial gaps: estimate accept/decline, quote notes, doc templates,
-- contractors CRM, product serial units, cost tax/receipts.

-- ---------------------------------------------------------------------------
-- Estimate customer response (accept / decline on public share link)
-- ---------------------------------------------------------------------------
alter table public.av_opportunities
  add column if not exists estimate_response text,
  add column if not exists estimate_responded_at timestamptz,
  add column if not exists estimate_response_note text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'av_opportunities_estimate_response_check'
  ) then
    alter table public.av_opportunities
      add constraint av_opportunities_estimate_response_check
      check (
        estimate_response is null
        or estimate_response in ('accepted', 'declined')
      );
  end if;
end $$;

comment on column public.av_opportunities.estimate_response is
  'Customer accept/decline on the public estimate share link.';

-- ---------------------------------------------------------------------------
-- Job cost tax + receipt attachment (USD shop; no FX)
-- ---------------------------------------------------------------------------
alter table public.av_job_costs
  add column if not exists tax_amount numeric(12,2) not null default 0
    check (tax_amount >= 0),
  add column if not exists currency_code text not null default 'USD',
  add column if not exists receipt_storage_path text not null default '',
  add column if not exists receipt_file_name text not null default '';

comment on column public.av_job_costs.tax_amount is
  'Optional tax on this cost row (not invoice sales tax).';
comment on column public.av_job_costs.currency_code is
  'ISO currency; Hub reporting stays USD — no FX conversion.';

-- ---------------------------------------------------------------------------
-- Quote staff discussion notes (KM discussions lite)
-- ---------------------------------------------------------------------------
create table if not exists public.av_opportunity_notes (
  id                uuid primary key default gen_random_uuid(),
  opportunity_id    uuid not null references public.av_opportunities(id) on delete cascade,
  body              text not null,
  author_id         uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint av_opportunity_notes_body_not_blank check (char_length(trim(body)) > 0)
);

create index if not exists av_opportunity_notes_opp_idx
  on public.av_opportunity_notes (opportunity_id, created_at desc);

comment on table public.av_opportunity_notes is
  'Staff discussion notes on a Hub AV quote (KM discussions).';

-- ---------------------------------------------------------------------------
-- Document templates (estimate / invoice terms text)
-- ---------------------------------------------------------------------------
create table if not exists public.av_document_templates (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  kind              text not null default 'estimate'
                      check (kind in ('estimate', 'invoice', 'other')),
  terms             text not null default '',
  is_default        boolean not null default false,
  is_active         boolean not null default true,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint av_document_templates_name_not_blank check (char_length(trim(name)) > 0)
);

create index if not exists av_document_templates_kind_idx
  on public.av_document_templates (kind, is_active);

drop trigger if exists av_document_templates_updated_at on public.av_document_templates;
create trigger av_document_templates_updated_at
  before update on public.av_document_templates
  for each row execute function public.set_updated_at();

comment on table public.av_document_templates is
  'Reusable terms/boilerplate for estimates and invoices (KM document_templates).';

-- ---------------------------------------------------------------------------
-- Contractors CRM (freelancers without Hub login)
-- ---------------------------------------------------------------------------
create table if not exists public.av_contractors (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  contact_name      text not null default '',
  email             text not null default '',
  phone             text not null default '',
  skills            text[] not null default '{}',
  day_rate          numeric(12,2) check (day_rate is null or day_rate >= 0),
  hour_rate         numeric(12,2) check (hour_rate is null or hour_rate >= 0),
  notes             text not null default '',
  is_active         boolean not null default true,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint av_contractors_name_not_blank check (char_length(trim(name)) > 0)
);

create index if not exists av_contractors_name_idx
  on public.av_contractors (lower(name));
create index if not exists av_contractors_active_idx
  on public.av_contractors (is_active);

drop trigger if exists av_contractors_updated_at on public.av_contractors;
create trigger av_contractors_updated_at
  before update on public.av_contractors
  for each row execute function public.set_updated_at();

comment on table public.av_contractors is
  'External AV contractors/freelancers for crew bookings (KM contractors).';

-- Allow booking a Hub person OR an external contractor (exactly one).
alter table public.av_contractor_bookings
  alter column profile_id drop not null;

alter table public.av_contractor_bookings
  add column if not exists contractor_id uuid
    references public.av_contractors(id) on delete restrict;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'av_contractor_bookings_person_check'
  ) then
    alter table public.av_contractor_bookings
      add constraint av_contractor_bookings_person_check
      check (
        (profile_id is not null and contractor_id is null)
        or (profile_id is null and contractor_id is not null)
      );
  end if;
end $$;

create index if not exists av_contractor_bookings_contractor_idx
  on public.av_contractor_bookings (contractor_id, starts_at);

-- ---------------------------------------------------------------------------
-- Serialized product units (barcode / serial)
-- ---------------------------------------------------------------------------
create table if not exists public.av_product_units (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.av_products(id) on delete cascade,
  serial            text not null,
  barcode           text not null default '',
  status            text not null default 'in'
                      check (status in ('in', 'out', 'retired')),
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint av_product_units_serial_not_blank check (char_length(trim(serial)) > 0)
);

create unique index if not exists av_product_units_serial_key
  on public.av_product_units (lower(serial));
create unique index if not exists av_product_units_barcode_key
  on public.av_product_units (lower(barcode))
  where barcode <> '';
create index if not exists av_product_units_product_idx
  on public.av_product_units (product_id, status);

drop trigger if exists av_product_units_updated_at on public.av_product_units;
create trigger av_product_units_updated_at
  before update on public.av_product_units
  for each row execute function public.set_updated_at();

comment on table public.av_product_units is
  'Individual serialized assets for rental products (KM serials).';

alter table public.av_gear_movements
  add column if not exists unit_id uuid
    references public.av_product_units(id) on delete set null;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.av_opportunity_notes enable row level security;
alter table public.av_document_templates enable row level security;
alter table public.av_contractors enable row level security;
alter table public.av_product_units enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'av_opportunity_notes',
    'av_document_templates',
    'av_contractors',
    'av_product_units'
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

grant select, insert, update, delete on public.av_opportunity_notes to authenticated, service_role;
grant select, insert, update, delete on public.av_document_templates to authenticated, service_role;
grant select, insert, update, delete on public.av_contractors to authenticated, service_role;
grant select, insert, update, delete on public.av_product_units to authenticated, service_role;
