-- Phase 3 remainder: job costs + contractor bookings on Hub quotes.
-- Job costs are separate from Hub staff expense_requests reimbursements.
-- Crew bookings link profiles (People), not a separate contractors CRM.

-- ---------------------------------------------------------------------------
-- Job costs
-- ---------------------------------------------------------------------------

create table if not exists public.av_job_costs (
  id                uuid primary key default gen_random_uuid(),
  opportunity_id    uuid not null references public.av_opportunities(id) on delete cascade,
  amount            numeric(12,2) not null check (amount > 0),
  category          text not null default 'other'
                      check (category in (
                        'labor', 'sub_hire', 'transport', 'consumable', 'fee', 'other'
                      )),
  supplier_id       uuid references public.av_suppliers(id) on delete set null,
  description       text not null default '',
  cost_date         date not null default (timezone('America/New_York', now()))::date,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists av_job_costs_opportunity_idx
  on public.av_job_costs (opportunity_id, cost_date);
create index if not exists av_job_costs_supplier_idx
  on public.av_job_costs (supplier_id);

drop trigger if exists av_job_costs_updated_at on public.av_job_costs;
create trigger av_job_costs_updated_at
  before update on public.av_job_costs
  for each row execute function public.set_updated_at();

comment on table public.av_job_costs is
  'Costs to deliver a Hub AV job (labor, sub-hire, etc.) for margin.';

-- ---------------------------------------------------------------------------
-- Contractor bookings (profiles as crew)
-- ---------------------------------------------------------------------------

create table if not exists public.av_contractor_bookings (
  id                uuid primary key default gen_random_uuid(),
  opportunity_id    uuid not null references public.av_opportunities(id) on delete cascade,
  profile_id        uuid not null references public.profiles(id) on delete restrict,
  role_label        text not null default '',
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  day_rate          numeric(12,2) check (day_rate is null or day_rate >= 0),
  status            text not null default 'confirmed'
                      check (status in ('offered', 'confirmed', 'declined', 'cancelled')),
  notes             text not null default '',
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint av_contractor_bookings_window check (ends_at >= starts_at)
);

create index if not exists av_contractor_bookings_opp_idx
  on public.av_contractor_bookings (opportunity_id, starts_at);
create index if not exists av_contractor_bookings_profile_idx
  on public.av_contractor_bookings (profile_id, starts_at);

drop trigger if exists av_contractor_bookings_updated_at on public.av_contractor_bookings;
create trigger av_contractor_bookings_updated_at
  before update on public.av_contractor_bookings
  for each row execute function public.set_updated_at();

comment on table public.av_contractor_bookings is
  'Crew assigned to a Hub AV job (profile from People).';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.av_job_costs enable row level security;
alter table public.av_contractor_bookings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'av_job_costs',
    'av_contractor_bookings'
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

-- Local Postgres default privileges omit DML for authenticated; hosted Supabase
-- already grants these. Safe to re-run.
grant select, insert, update, delete on public.av_job_costs to authenticated, service_role;
grant select, insert, update, delete on public.av_contractor_bookings to authenticated, service_role;
