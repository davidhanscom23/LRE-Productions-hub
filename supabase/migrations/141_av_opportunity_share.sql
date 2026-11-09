-- Public estimate share link for AV opportunities (customer-facing; no auth).
-- Venue markup stays hidden: public surfaces never expose markup fields.

alter table public.av_opportunities
  add column if not exists share_token text,
  add column if not exists share_enabled boolean not null default false;

comment on column public.av_opportunities.share_token is
  'Opaque token for /estimate/<token> public read-only estimate.';
comment on column public.av_opportunities.share_enabled is
  'When true and share_token is set, the public estimate link is live.';

create unique index if not exists av_opportunities_share_token_key
  on public.av_opportunities (share_token)
  where share_token is not null;
