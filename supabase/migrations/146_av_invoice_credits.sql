-- Invoice credit notes: reduce AR without voiding the whole invoice.

alter table public.av_invoices
  add column if not exists amount_credited numeric(12,2) not null default 0;

create sequence if not exists public.av_credit_ref_seq;

create table if not exists public.av_invoice_credits (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.av_invoices(id) on delete cascade,
  reference     text not null,
  amount        numeric(12,2) not null check (amount > 0),
  issued_at     date not null default (timezone('America/New_York', now()))::date,
  reason        text not null default '',
  notes         text not null default '',
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint av_invoice_credits_reference_not_blank check (char_length(trim(reference)) > 0)
);

create unique index if not exists av_invoice_credits_reference_key
  on public.av_invoice_credits (reference);
create index if not exists av_invoice_credits_invoice_idx
  on public.av_invoice_credits (invoice_id, issued_at);

create or replace function public.av_invoice_credits_assign_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or btrim(new.reference) = '' then
    new.reference := 'CN-' || lpad(nextval('public.av_credit_ref_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists av_invoice_credits_assign_reference on public.av_invoice_credits;
create trigger av_invoice_credits_assign_reference
  before insert on public.av_invoice_credits
  for each row execute function public.av_invoice_credits_assign_reference();

comment on table public.av_invoice_credits is
  'Credit notes applied to av_invoices; reduce outstanding AR.';
comment on column public.av_invoices.amount_credited is
  'Sum of applied credit notes (denormalized).';

alter table public.av_invoice_credits enable row level security;

do $$
declare
  t text := 'av_invoice_credits';
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

grant select, insert, update, delete on public.av_invoice_credits to authenticated, service_role;
grant usage, select on sequence public.av_credit_ref_seq to authenticated, service_role;
