-- Customer e-sign for estimates, contracts, and change orders.
-- Reuses Hub drawn-signature pattern (PNG data URL + name/email/IP/UA).

-- ---------------------------------------------------------------------------
-- Opportunity contract response (mirrors estimate_response*)
-- ---------------------------------------------------------------------------
alter table public.av_opportunities
  add column if not exists contract_response text,
  add column if not exists contract_responded_at timestamptz,
  add column if not exists contract_response_note text not null default '',
  add column if not exists estimate_signer_name text not null default '',
  add column if not exists contract_signer_name text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'av_opportunities_contract_response_check'
  ) then
    alter table public.av_opportunities
      add constraint av_opportunities_contract_response_check
      check (
        contract_response is null
        or contract_response in ('accepted', 'declined')
      );
  end if;
end $$;

comment on column public.av_opportunities.contract_response is
  'Customer accept/decline on the public contract e-sign panel.';
comment on column public.av_opportunities.estimate_signer_name is
  'Name from customer e-sign when estimate was accepted.';
comment on column public.av_opportunities.contract_signer_name is
  'Name from customer e-sign when contract was accepted.';

-- ---------------------------------------------------------------------------
-- Change orders (customer-facing amendments to a quote/order)
-- ---------------------------------------------------------------------------
create table if not exists public.av_change_orders (
  id                uuid primary key default gen_random_uuid(),
  opportunity_id    uuid not null references public.av_opportunities(id) on delete cascade,
  number            text not null,
  subject           text not null default '',
  summary           text not null default '',
  amount_delta      numeric(12,2) not null default 0,
  status            text not null default 'draft'
                      check (status in ('draft', 'sent', 'accepted', 'declined', 'void')),
  share_token       text,
  share_enabled     boolean not null default false,
  response_note     text not null default '',
  signer_name       text not null default '',
  responded_at      timestamptz,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint av_change_orders_number_not_blank check (char_length(trim(number)) > 0),
  unique (opportunity_id, number)
);

create unique index if not exists av_change_orders_share_token_uidx
  on public.av_change_orders (share_token)
  where share_token is not null;

create index if not exists av_change_orders_opp_idx
  on public.av_change_orders (opportunity_id, created_at desc);

comment on table public.av_change_orders is
  'Customer-facing change orders on a Hub quote/order; public share uses share_token.';

-- ---------------------------------------------------------------------------
-- Signature audit rows (estimate / contract / change_order)
-- ---------------------------------------------------------------------------
create table if not exists public.av_customer_document_signatures (
  id                  uuid primary key default gen_random_uuid(),
  opportunity_id      uuid not null references public.av_opportunities(id) on delete cascade,
  change_order_id     uuid references public.av_change_orders(id) on delete cascade,
  doc_kind            text not null
                        check (doc_kind in ('estimate', 'contract', 'change_order')),
  response            text not null
                        check (response in ('accepted', 'declined')),
  signer_name         text not null default '',
  signer_email        text not null default '',
  signature_data      text,
  response_note       text not null default '',
  ip_address          text,
  user_agent          text,
  share_token_used    text,
  signed_at           timestamptz not null default now(),
  constraint av_cust_sig_accept_requires_sig check (
    response = 'declined'
    or (
      char_length(trim(signer_name)) > 0
      and signature_data is not null
      and signature_data like 'data:image/%'
    )
  ),
  constraint av_cust_sig_change_order_fk check (
    (doc_kind = 'change_order' and change_order_id is not null)
    or (doc_kind <> 'change_order' and change_order_id is null)
  )
);

create unique index if not exists av_cust_sig_opp_kind_accepted_uidx
  on public.av_customer_document_signatures (opportunity_id, doc_kind)
  where response = 'accepted' and doc_kind in ('estimate', 'contract');

create unique index if not exists av_cust_sig_co_accepted_uidx
  on public.av_customer_document_signatures (change_order_id)
  where response = 'accepted' and doc_kind = 'change_order';

create index if not exists av_cust_sig_opp_idx
  on public.av_customer_document_signatures (opportunity_id, signed_at desc);

comment on table public.av_customer_document_signatures is
  'Customer drawn e-signatures (and declines) for estimates, contracts, and change orders.';

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.av_change_orders enable row level security;
alter table public.av_customer_document_signatures enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'av_change_orders',
    'av_customer_document_signatures'
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

grant select, insert, update, delete on public.av_change_orders to authenticated, service_role;
grant select, insert, update, delete on public.av_customer_document_signatures to authenticated, service_role;
