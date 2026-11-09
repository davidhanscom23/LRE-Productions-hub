-- Two kinds of AV billing:
--   direct = Vident bills the client (the 23% surcharge shows on the estimate and invoice)
--   venue  = the venue pays Vident and puts the AV on the client's master bill
--            (no surcharge row; the paperwork says the venue may add its own service charge and taxes)
-- It is chosen once on the estimate and carried to the invoice.
alter table public.av_opportunities
  add column if not exists billing_type text not null default 'direct'
    check (billing_type in ('direct', 'venue'));

alter table public.av_invoices
  add column if not exists billing_type text not null default 'direct'
    check (billing_type in ('direct', 'venue'));
