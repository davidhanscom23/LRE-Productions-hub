-- Phase 3 money: suppliers + invoices + payments (KM invoices/payments/suppliers parity).
-- Customer-facing amounts only on invoice lines (venue markup already folded in).

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------

create table if not exists public.av_suppliers (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  contact_name      text not null default '',
  email             text not null default '',
  phone             text not null default '',
  notes             text not null default '',
  is_active         boolean not null default true,
  external_rms_id   text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint av_suppliers_name_not_blank check (char_length(trim(name)) > 0)
);

create unique index if not exists av_suppliers_rms_id_key
  on public.av_suppliers (external_rms_id) where external_rms_id is not null;
create index if not exists av_suppliers_name_idx on public.av_suppliers (lower(name));

drop trigger if exists av_suppliers_updated_at on public.av_suppliers;
create trigger av_suppliers_updated_at
  before update on public.av_suppliers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

create sequence if not exists public.av_invoice_ref_seq;

create table if not exists public.av_invoices (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null,
  opportunity_id    uuid references public.av_opportunities(id) on delete set null,
  customer_id       uuid references public.av_customers(id) on delete set null,
  subject           text not null default '',
  status            text not null default 'draft'
                      check (status in ('draft', 'sent', 'partial', 'paid', 'void')),
  issued_at         date,
  due_at            date,
  subtotal          numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  amount_paid       numeric(12,2) not null default 0,
  notes             text not null default '',
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint av_invoices_reference_not_blank check (char_length(trim(reference)) > 0)
);

create unique index if not exists av_invoices_reference_key
  on public.av_invoices (reference);
create index if not exists av_invoices_opportunity_idx
  on public.av_invoices (opportunity_id);
create index if not exists av_invoices_customer_idx
  on public.av_invoices (customer_id);
create index if not exists av_invoices_status_idx
  on public.av_invoices (status);

create or replace function public.av_invoices_assign_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or btrim(new.reference) = '' then
    new.reference := 'INV-' || lpad(nextval('public.av_invoice_ref_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists av_invoices_assign_reference on public.av_invoices;
create trigger av_invoices_assign_reference
  before insert on public.av_invoices
  for each row execute function public.av_invoices_assign_reference();

drop trigger if exists av_invoices_updated_at on public.av_invoices;
create trigger av_invoices_updated_at
  before update on public.av_invoices
  for each row execute function public.set_updated_at();

create table if not exists public.av_invoice_lines (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.av_invoices(id) on delete cascade,
  description   text not null default '',
  qty           numeric(12,2) not null default 1 check (qty > 0),
  unit_price    numeric(12,2) not null default 0,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists av_invoice_lines_invoice_idx
  on public.av_invoice_lines (invoice_id, sort_order);

create table if not exists public.av_payments (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.av_invoices(id) on delete cascade,
  amount        numeric(12,2) not null check (amount > 0),
  received_at   date not null default (timezone('America/New_York', now()))::date,
  method        text not null default '',
  reference     text not null default '',
  notes         text not null default '',
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists av_payments_invoice_idx
  on public.av_payments (invoice_id, received_at);

comment on table public.av_invoices is
  'Customer invoices for Hub AV jobs (customer-facing totals).';
comment on table public.av_payments is
  'Payments applied to av_invoices.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.av_suppliers enable row level security;
alter table public.av_invoices enable row level security;
alter table public.av_invoice_lines enable row level security;
alter table public.av_payments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'av_suppliers',
    'av_invoices',
    'av_invoice_lines',
    'av_payments'
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
