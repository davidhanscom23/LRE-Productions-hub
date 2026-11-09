-- Invoice sales tax, change-order lines, signed-PDF email audit columns.

-- ---------------------------------------------------------------------------
-- Shop default sales tax rate (app_settings KV)
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, updated_at)
values ('av_default_sales_tax_rate_pct', '0', now())
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Customer tax exempt
-- ---------------------------------------------------------------------------
alter table public.av_customers
  add column if not exists tax_exempt boolean not null default false;

comment on column public.av_customers.tax_exempt is
  'When true, Hub invoices snapshotted tax rate is 0 for this customer.';

-- ---------------------------------------------------------------------------
-- Invoice tax snapshot
-- ---------------------------------------------------------------------------
alter table public.av_invoices
  add column if not exists tax_rate_pct numeric(7,4) not null default 0
    check (tax_rate_pct >= 0 and tax_rate_pct <= 100),
  add column if not exists tax_amount numeric(12,2) not null default 0
    check (tax_amount >= 0);

comment on column public.av_invoices.tax_rate_pct is
  'Sales tax % snapshotted on the invoice (overrideable while draft).';
comment on column public.av_invoices.tax_amount is
  'Sales tax dollars = round(subtotal * tax_rate_pct / 100). total = subtotal + tax_amount.';

-- ---------------------------------------------------------------------------
-- Change order lines
-- ---------------------------------------------------------------------------
create table if not exists public.av_change_order_lines (
  id                uuid primary key default gen_random_uuid(),
  change_order_id   uuid not null references public.av_change_orders(id) on delete cascade,
  source_line_id    uuid references public.av_opportunity_lines(id) on delete set null,
  product_id        uuid references public.av_products(id) on delete set null,
  service_id        uuid references public.av_services(id) on delete set null,
  description       text not null default '',
  qty               numeric(12,2) not null default 1,
  unit_price        numeric(12,2) not null default 0,
  discount_pct      numeric(7,4) not null default 0
                      check (discount_pct >= 0 and discount_pct <= 100),
  sort_order        integer not null default 0,
  text_kind         text check (text_kind is null or text_kind in ('rental', 'sale')),
  apply_mode        text not null default 'add'
                      check (apply_mode in ('add', 'adjust_qty', 'remove')),
  created_at        timestamptz not null default now(),
  constraint av_change_order_lines_desc_not_blank check (
    apply_mode = 'remove' or char_length(trim(description)) > 0
  ),
  constraint av_change_order_lines_source_for_mutate check (
    (apply_mode = 'add' and source_line_id is null)
    or (apply_mode in ('adjust_qty', 'remove') and source_line_id is not null)
  )
);

create index if not exists av_change_order_lines_co_idx
  on public.av_change_order_lines (change_order_id, sort_order);

comment on table public.av_change_order_lines is
  'Line items on a change order; applied onto av_opportunity_lines when accepted.';

-- ---------------------------------------------------------------------------
-- Signature audit: optional emailed-at stamp
-- ---------------------------------------------------------------------------
alter table public.av_customer_document_signatures
  add column if not exists signed_pdf_emailed_at timestamptz,
  add column if not exists signed_pdf_email_to text not null default '';

comment on column public.av_customer_document_signatures.signed_pdf_emailed_at is
  'When a stamped signed PDF was emailed to the customer (best-effort).';

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.av_change_order_lines enable row level security;

do $$
declare
  t text := 'av_change_order_lines';
begin
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
end $$;

grant select, insert, update, delete on public.av_change_order_lines to authenticated, service_role;
