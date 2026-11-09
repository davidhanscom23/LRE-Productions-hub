-- Book Now Stripe deposit: per-portal deposit % + request payment tracking.

alter table public.venue_portals
  add column if not exists deposit_pct numeric(5,2) not null default 50
    check (deposit_pct >= 0 and deposit_pct <= 100);

comment on column public.venue_portals.deposit_pct is
  'Percent of estimated (post-discount) total collected as Book Now Stripe deposit.';

alter table public.venue_portal_quote_requests
  add column if not exists deposit_amount numeric(12,2) not null default 0
    check (deposit_amount >= 0),
  add column if not exists deposit_status text not null default 'none'
    check (deposit_status in ('none', 'pending', 'paid', 'failed', 'canceled')),
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists deposit_paid_at timestamptz;

create unique index if not exists venue_portal_quote_requests_stripe_session_key
  on public.venue_portal_quote_requests (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

comment on column public.venue_portal_quote_requests.deposit_status is
  'Book Now deposit: none (quote-only), pending (Checkout open), paid, failed, canceled.';
