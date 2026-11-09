-- Local development seed.
--
-- Runs automatically after migrations on `supabase start` / `supabase db reset`.
--
-- Why this exists: the Supabase CLI applies migrations as the `postgres` role.
-- In the local Postgres image, the default privileges for `postgres`-owned tables
-- in `public` only grant TRUNCATE/REFERENCES/TRIGGER (not SELECT/INSERT/UPDATE/DELETE)
-- to the `anon`, `authenticated`, and `service_role` roles. Hosted Supabase grants
-- full DML automatically, so the app works there but hits "permission denied for
-- table ..." locally. These grants restore the expected DML access. Row Level
-- Security policies defined in the migrations still govern actual row access.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Optional local AV sample shop (idempotent). Same fixtures as Overview →
-- "Load sample shop" (external_rms_id hub-demo:*). Safe on repeated db reset.
-- Hosted prod should use the in-app button instead of this seed block.
-- ---------------------------------------------------------------------------
do $$
declare
  rate_id uuid;
  gear_start timestamptz := (date_trunc('day', now() at time zone 'America/New_York')
    + interval '5 days' + interval '7 hours') at time zone 'America/New_York';
  gear_end timestamptz := (date_trunc('day', now() at time zone 'America/New_York')
    + interval '5 days' + interval '23 hours') at time zone 'America/New_York';
  draft_start timestamptz := (date_trunc('day', now() at time zone 'America/New_York')
    + interval '10 days' + interval '8 hours') at time zone 'America/New_York';
  draft_end timestamptz := (date_trunc('day', now() at time zone 'America/New_York')
    + interval '10 days' + interval '22 hours') at time zone 'America/New_York';begin
  if exists (
    select 1 from public.av_customers
    where external_rms_id = 'hub-demo:customer-acme'
  ) then
    return;
  end if;

  select id into rate_id from public.av_rate_definitions where is_default limit 1;

  insert into public.av_customers (
    id, name, contact_name, email, phone, city, region, postal_code, notes, external_rms_id
  ) values
    ('a1111111-1111-4111-8111-111111111101', 'Acme Productions', 'Jordan Lee',
     'jordan@acme-productions.example', '904-555-0101', 'Jacksonville', 'FL', '32202',
     'Sample shop customer (hub-demo).', 'hub-demo:customer-acme'),
    ('a1111111-1111-4111-8111-111111111102', 'Coastal Weddings LLC', 'Sam Rivera',
     'sam@coastal-weddings.example', '904-555-0144', 'Ponte Vedra', 'FL', '32081',
     'Sample shop customer (hub-demo).', 'hub-demo:customer-coastal')
  on conflict (id) do nothing;

  insert into public.av_job_venues (
    id, name, contact_name, email, phone, address_line1, city, region,
    access_notes, power_notes, parking_notes, external_rms_id
  ) values
    ('a2222222-2222-4222-8222-222222222201', 'Grand Ballroom', 'Front desk',
     'events@grandballroom.example', '904-555-0200', '100 Harbor St', 'Jacksonville', 'FL',
     'Loading dock on east side.', '2× 50A shore power.', 'Vendor lot behind venue.',
     'hub-demo:venue-ballroom'),
    ('a2222222-2222-4222-8222-222222222202', 'Rooftop Deck', 'Ops', '', '904-555-0211',
     '', 'Jacksonville', 'FL', 'Freight elevator to roof.', 'Limited circuits — bring distro.',
     '', 'hub-demo:venue-rooftop')
  on conflict (id) do nothing;

  insert into public.av_product_groups (id, name, sort_order) values
    ('a3333333-3333-4333-8333-333333333301', 'Audio (sample)', 10),
    ('a3333333-3333-4333-8333-333333333302', 'Lighting (sample)', 20)
  on conflict (id) do nothing;

  insert into public.av_products (
    id, group_id, name, code, kind, rental_price, sale_price, qty_owned, buffer_pct,
    turnaround_hours, external_rms_id
  ) values
    ('a4444444-4444-4444-8444-444444444401', 'a3333333-3333-4333-8333-333333333301',
     'QSC K12.2 Speaker', 'SPK-K12', 'rental', 85, null, 8, 10, 4, 'hub-demo:product-speaker'),
    ('a4444444-4444-4444-8444-444444444402', 'a3333333-3333-4333-8333-333333333301',
     'Shure ULXD Handheld', 'MIC-ULXD', 'rental', 65, null, 12, 5, 2, 'hub-demo:product-mic'),
    ('a4444444-4444-4444-8444-444444444403', 'a3333333-3333-4333-8333-333333333301',
     'XLR Cable 25ft', 'CAB-XLR25', 'consumable', 0, 18, 40, 0, 0, 'hub-demo:product-cable'),
    ('a4444444-4444-4444-8444-444444444404', 'a3333333-3333-4333-8333-333333333302',
     'Chauvet SlimPAR Pro', 'LT-SLIM', 'rental', 25, null, 24, 10, 2, 'hub-demo:product-uplight')
  on conflict (id) do nothing;

  insert into public.av_services (id, name, code, kind, unit_price, external_rms_id) values
    ('a5555555-5555-4555-8555-555555555501', 'A1 Tech (day)', 'SVC-A1', 'crew', 550, 'hub-demo:service-tech'),
    ('a5555555-5555-4555-8555-555555555502', 'Box truck run', 'SVC-TRUCK', 'transport', 175, 'hub-demo:service-truck')
  on conflict (id) do nothing;

  insert into public.av_suppliers (id, name, contact_name, email, phone, notes, external_rms_id) values
    ('a6666666-6666-4666-8666-666666666601', 'First Coast Subhire', 'Alex',
     'desk@firstcoast-subhire.example', '904-555-0300', 'Sample supplier (hub-demo).',
     'hub-demo:supplier-local')
  on conflict (id) do nothing;

  insert into public.av_opportunities (
    id, reference, subject, status, customer_id, venue_id, rate_definition_id,
    gear_starts_at, gear_ends_at, charge_starts_at, charge_ends_at,
    venue_markup_enabled, venue_markup_pct, notes, external_rms_id
  ) values
    ('a7777777-7777-4777-8777-777777777701', '', 'Acme product launch (sample draft)', 'draft',
     'a1111111-1111-4111-8111-111111111101', 'a2222222-2222-4222-8222-222222222201', rate_id,
     draft_start, draft_end, draft_start, draft_end, true, 15,
     'Sample draft quote (hub-demo).', 'hub-demo:opp-draft'),
    ('a7777777-7777-4777-8777-777777777702', '', 'Coastal wedding ceremony (sample quotation)', 'quotation',
     'a1111111-1111-4111-8111-111111111102', 'a2222222-2222-4222-8222-222222222202', rate_id,
     gear_start, gear_end, gear_start, gear_end, false, 0,
     'Sample reserved quotation (hub-demo).', 'hub-demo:opp-quotation')
  on conflict (id) do nothing;

  insert into public.av_opportunity_groups (id, opportunity_id, name, sort_order) values
    ('a8888888-8888-4888-8888-888888888801', 'a7777777-7777-4777-8777-777777777701', 'Main PA', 0),
    ('a8888888-8888-4888-8888-888888888802', 'a7777777-7777-4777-8777-777777777702', 'Ceremony', 0)
  on conflict (id) do nothing;

  insert into public.av_opportunity_lines (
    id, opportunity_id, group_id, product_id, service_id, description, qty, unit_price, text_kind, sort_order
  ) values
    ('a9999999-9999-4999-8999-999999999901', 'a7777777-7777-4777-8777-777777777701',
     'a8888888-8888-4888-8888-888888888801', 'a4444444-4444-4444-8444-444444444401', null,
     'QSC K12.2 Speaker', 4, 85, null, 0),
    ('a9999999-9999-4999-8999-999999999902', 'a7777777-7777-4777-8777-777777777701',
     'a8888888-8888-4888-8888-888888888801', 'a4444444-4444-4444-8444-444444444402', null,
     'Shure ULXD Handheld', 2, 65, null, 1),
    ('a9999999-9999-4999-8999-999999999903', 'a7777777-7777-4777-8777-777777777701',
     'a8888888-8888-4888-8888-888888888801', null, 'a5555555-5555-4555-8555-555555555501',
     'A1 Tech (day)', 1, 550, null, 2),
    ('a9999999-9999-4999-8999-999999999904', 'a7777777-7777-4777-8777-777777777701',
     'a8888888-8888-4888-8888-888888888801', null, null,
     'Custom stage skirt (text rental)', 1, 120, 'rental', 3),
    ('a9999999-9999-4999-8999-999999999905', 'a7777777-7777-4777-8777-777777777702',
     'a8888888-8888-4888-8888-888888888802', 'a4444444-4444-4444-8444-444444444401', null,
     'QSC K12.2 Speaker', 2, 85, null, 0),
    ('a9999999-9999-4999-8999-999999999906', 'a7777777-7777-4777-8777-777777777702',
     'a8888888-8888-4888-8888-888888888802', 'a4444444-4444-4444-8444-444444444404', null,
     'Chauvet SlimPAR Pro', 8, 25, null, 1),
    ('a9999999-9999-4999-8999-999999999907', 'a7777777-7777-4777-8777-777777777702',
     'a8888888-8888-4888-8888-888888888802', null, 'a5555555-5555-4555-8555-555555555502',
     'Box truck run', 1, 175, null, 2)
  on conflict (id) do nothing;

  delete from public.av_holds where opportunity_id = 'a7777777-7777-4777-8777-777777777702';
  insert into public.av_holds (opportunity_id, line_id, product_id, qty, starts_at, ends_at)
  values
    ('a7777777-7777-4777-8777-777777777702', 'a9999999-9999-4999-8999-999999999905',
     'a4444444-4444-4444-8444-444444444401', 2, gear_start, gear_end),
    ('a7777777-7777-4777-8777-777777777702', 'a9999999-9999-4999-8999-999999999906',
     'a4444444-4444-4444-8444-444444444404', 8, gear_start, gear_end);

  insert into public.av_activities (id, opportunity_id, subject, kind, due_at, notes)
  values (
    'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaa01',
    'a7777777-7777-4777-8777-777777777702',
    'Confirm power drop with venue (sample)',
    'task',
    gear_start,
    'Sample activity (hub-demo).'
  )
  on conflict (id) do nothing;
end $$;
