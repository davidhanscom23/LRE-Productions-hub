-- Link venue quote requests to Hub opportunities; public invoice pay tokens.

alter table public.venue_portal_quote_requests
  add column if not exists opportunity_id uuid
    references public.av_opportunities (id) on delete set null,
  add column if not exists converted_at timestamptz;

create unique index if not exists venue_portal_quote_requests_opportunity_uidx
  on public.venue_portal_quote_requests (opportunity_id)
  where opportunity_id is not null;

comment on column public.venue_portal_quote_requests.opportunity_id is
  'Hub AV quote created from this venue request (convert once).';

alter table public.av_invoices
  add column if not exists pay_token text not null default '',
  add column if not exists pay_enabled boolean not null default false,
  add column if not exists stripe_checkout_session_id text not null default '';

create unique index if not exists av_invoices_pay_token_uidx
  on public.av_invoices (pay_token)
  where pay_token <> '';

comment on column public.av_invoices.pay_token is
  'Public token for /invoice/{token} Stripe pay link.';
comment on column public.av_invoices.pay_enabled is
  'When true, customers may pay the outstanding balance via Stripe Checkout.';
