-- QuickBooks Online sync (one-way, Hub -> QuickBooks): connection tokens and per-record sync marks.
-- The connection table has RLS on and NO policies on purpose: only the server (service role) reads it,
-- so tokens are never reachable from the browser.

create table if not exists public.quickbooks_connection (
  id                     integer primary key default 1 check (id = 1),
  realm_id               text not null,
  company_name           text not null default '',
  access_token_enc       text not null,
  refresh_token_enc      text not null,
  access_expires_at      timestamptz not null,
  refresh_expires_at     timestamptz not null,
  connected_by           uuid references public.profiles (id) on delete set null,
  connected_at           timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table public.quickbooks_connection enable row level security;
grant select, insert, update, delete on public.quickbooks_connection to service_role;

alter table public.project_invoices
  add column if not exists qb_invoice_id text,
  add column if not exists qb_synced_at timestamptz,
  add column if not exists qb_sync_error text;

alter table public.project_invoice_payments
  add column if not exists qb_payment_id text;
