-- Link confirmed crew bookings to labor job costs (day_rate × Eastern billable days).

alter table public.av_job_costs
  add column if not exists booking_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'av_job_costs_booking_id_fkey'
  ) then
    alter table public.av_job_costs
      add constraint av_job_costs_booking_id_fkey
      foreign key (booking_id) references public.av_contractor_bookings(id)
      on delete cascade;
  end if;
end $$;

create unique index if not exists av_job_costs_booking_id_key
  on public.av_job_costs (booking_id)
  where booking_id is not null;

alter table public.av_contractor_bookings
  add column if not exists roll_into_costs boolean not null default true;

comment on column public.av_job_costs.booking_id is
  'When set, this labor cost is synced from the crew booking (confirm × day_rate).';
comment on column public.av_contractor_bookings.roll_into_costs is
  'When true and status=confirmed with a day_rate, auto-create/update labor av_job_costs.';
