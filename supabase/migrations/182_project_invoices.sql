-- Project invoices: bill HoneyBook projects from the Hub (line items, installment plans,
-- Stripe pay link, manual payments). Separate from the AV ERP invoices (av_invoices).

create sequence if not exists public.project_invoice_number_seq;

create table if not exists public.project_invoices (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.honeybook_projects (id) on delete cascade,
  number           text not null unique,
  title            text not null default '',
  status           text not null default 'draft'
                     check (status in ('draft', 'sent', 'partial', 'paid', 'void')),
  issued_at        date,
  due_at           date,
  tax_rate_pct     numeric(5, 2) not null default 0 check (tax_rate_pct between 0 and 100),
  subtotal         numeric(12, 2) not null default 0,
  tax_amount       numeric(12, 2) not null default 0,
  total            numeric(12, 2) not null default 0 check (total >= 0),
  amount_paid      numeric(12, 2) not null default 0,
  notes            text not null default '',
  pay_token        text not null unique,
  pay_enabled      boolean not null default true,
  reminder_count   integer not null default 0,
  last_reminder_at timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists project_invoices_project_idx on public.project_invoices (project_id, created_at desc);
create index if not exists project_invoices_status_idx on public.project_invoices (status, due_at);

create or replace function public.project_invoices_assign_number()
returns trigger language plpgsql as $$
begin
  if new.number is null or btrim(new.number) = '' then
    new.number := 'PI-' || lpad(nextval('public.project_invoice_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists project_invoices_assign_number on public.project_invoices;
create trigger project_invoices_assign_number
  before insert on public.project_invoices
  for each row execute function public.project_invoices_assign_number();

create table if not exists public.project_invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references public.project_invoices (id) on delete cascade,
  sort_order       integer not null default 0,
  description      text not null default '',
  qty              numeric(10, 2) not null default 1 check (qty >= 0),
  unit_price       numeric(12, 2) not null default 0,
  catalog_item_id  uuid references public.service_catalog_items (id) on delete set null
);
create index if not exists project_invoice_lines_invoice_idx on public.project_invoice_lines (invoice_id, sort_order);

-- Payment schedule. Payments are applied to installments in order.
create table if not exists public.project_invoice_installments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.project_invoices (id) on delete cascade,
  sort_order  integer not null default 0,
  label       text not null default '',
  amount      numeric(12, 2) not null check (amount > 0),
  due_at      date
);
create index if not exists project_invoice_installments_invoice_idx
  on public.project_invoice_installments (invoice_id, sort_order);

create table if not exists public.project_invoice_payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.project_invoices (id) on delete cascade,
  amount       numeric(12, 2) not null check (amount > 0),
  received_at  date not null default current_date,
  method       text not null default 'other',
  reference    text,
  notes        text not null default '',
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists project_invoice_payments_invoice_idx on public.project_invoice_payments (invoice_id);
-- A Stripe payment can only be recorded once.
create unique index if not exists project_invoice_payments_stripe_uidx
  on public.project_invoice_payments (invoice_id, reference) where method = 'stripe' and reference is not null;

alter table public.project_invoices enable row level security;
alter table public.project_invoice_lines enable row level security;
alter table public.project_invoice_installments enable row level security;
alter table public.project_invoice_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['project_invoices', 'project_invoice_lines', 'project_invoice_installments', 'project_invoice_payments']
  loop
    execute format('drop policy if exists "%s read staff" on public.%I', t, t);
    execute format($p$create policy "%s read staff" on public.%I for select to authenticated
      using (public.current_user_role() in ('admin', 'trainer', 'staff'))$p$, t, t);
    execute format('drop policy if exists "%s write admin lead" on public.%I', t, t);
    execute format($p$create policy "%s write admin lead" on public.%I for all to authenticated
      using (public.current_user_role() in ('admin', 'trainer'))
      with check (public.current_user_role() in ('admin', 'trainer'))$p$, t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

grant usage, select on sequence public.project_invoice_number_seq to authenticated, service_role;
