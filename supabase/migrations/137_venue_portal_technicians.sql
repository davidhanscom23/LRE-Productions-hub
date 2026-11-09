-- Venue quote portals: multiple technician roles (e.g. Audio, Video), each
-- billed hourly or per day, linked to the packages that include them.

create table if not exists public.venue_portal_technicians (
  id          uuid primary key default gen_random_uuid(),
  portal_id   uuid not null references public.venue_portals(id) on delete cascade,
  name        text not null,
  rate_type   text not null default 'hourly' check (rate_type in ('hourly','daily')),
  rate        numeric(10,2) not null default 0 check (rate >= 0),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists venue_portal_technicians_portal_idx
  on public.venue_portal_technicians (portal_id, sort_order);

create table if not exists public.venue_portal_package_technicians (
  package_id    uuid not null references public.venue_portal_packages(id) on delete cascade,
  technician_id uuid not null references public.venue_portal_technicians(id) on delete cascade,
  primary key (package_id, technician_id)
);

drop trigger if exists venue_portal_technicians_set_updated_at on public.venue_portal_technicians;
create trigger venue_portal_technicians_set_updated_at
  before update on public.venue_portal_technicians
  for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array['venue_portal_technicians','venue_portal_package_technicians'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || ' admin all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || ' admin all', t);
    execute format('drop policy if exists %I on public.%I', t || ' staff read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role is distinct from ''guest''))',
      t || ' staff read', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

-- Backfill: keep existing pricing identical. Each portal that already has a
-- technician rate gets one hourly "Technician" role linked to the packages
-- that were flagged "includes technician".
do $$
declare p record; tid uuid;
begin
  for p in
    select id, tech_hourly_rate from public.venue_portals
    where tech_hourly_rate > 0
      and not exists (select 1 from public.venue_portal_technicians x where x.portal_id = venue_portals.id)
  loop
    insert into public.venue_portal_technicians (portal_id, name, rate_type, rate, sort_order)
    values (p.id, 'Technician', 'hourly', p.tech_hourly_rate, 10)
    returning id into tid;

    insert into public.venue_portal_package_technicians (package_id, technician_id)
    select pk.id, tid from public.venue_portal_packages pk
    where pk.portal_id = p.id and pk.includes_technician
    on conflict do nothing;
  end loop;
end $$;
