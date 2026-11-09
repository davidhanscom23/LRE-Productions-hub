-- Venue portal catalog seed + map Hyatt; invoice reminder columns.

-- ---------------------------------------------------------------------------
-- Invoice AR reminders
-- ---------------------------------------------------------------------------

alter table public.av_invoices
  add column if not exists last_reminded_at timestamptz,
  add column if not exists remind_count integer not null default 0
    check (remind_count >= 0);

comment on column public.av_invoices.last_reminded_at is
  'When the last customer unpaid-invoice reminder email was sent.';
comment on column public.av_invoices.remind_count is
  'How many unpaid reminder emails have been sent for this invoice.';

-- ---------------------------------------------------------------------------
-- Stable Hub catalog rows for venue portal packages / add-ons
-- ---------------------------------------------------------------------------

insert into public.av_product_groups (id, name, sort_order, is_active)
values (
  'a1570000-0000-4000-8000-000000000001',
  'Venue quote catalog',
  50,
  true
)
on conflict (id) do update set name = excluded.name, is_active = true;

insert into public.av_products (
  id, group_id, name, code, description, kind, rental_price, qty_owned,
  is_active, external_rms_id
) values
  ('a1570000-0000-4000-8000-000000000101', 'a1570000-0000-4000-8000-000000000001',
   'Complete Meeting package', 'VQ-PKG-COMPLETE', 'Venue portal package', 'package', 1850, 0, true,
   'venue-catalog:pkg-complete-meeting'),
  ('a1570000-0000-4000-8000-000000000102', 'a1570000-0000-4000-8000-000000000001',
   'Projector Presentation package', 'VQ-PKG-PROJECTOR', 'Venue portal package', 'package', 400, 0, true,
   'venue-catalog:pkg-projector-presentation'),
  ('a1570000-0000-4000-8000-000000000103', 'a1570000-0000-4000-8000-000000000001',
   'Presenter Audio package', 'VQ-PKG-PRESENTER-AUDIO', 'Venue portal package', 'package', 400, 0, true,
   'venue-catalog:pkg-presenter-audio'),
  ('a1570000-0000-4000-8000-000000000104', 'a1570000-0000-4000-8000-000000000001',
   'General Session package', 'VQ-PKG-GENERAL-SESSION', 'Venue portal package', 'package', 1200, 0, true,
   'venue-catalog:pkg-general-session'),
  ('a1570000-0000-4000-8000-000000000201', 'a1570000-0000-4000-8000-000000000001',
   'Wireless handheld microphone', 'VQ-MIC-HH', 'Venue portal add-on', 'rental', 75, 0, true,
   'venue-catalog:addon-wireless-mic'),
  ('a1570000-0000-4000-8000-000000000202', 'a1570000-0000-4000-8000-000000000001',
   'Wireless lapel microphone', 'VQ-MIC-LAV', 'Venue portal add-on', 'rental', 100, 0, true,
   'venue-catalog:addon-wireless-lapel'),
  ('a1570000-0000-4000-8000-000000000203', 'a1570000-0000-4000-8000-000000000001',
   'Tabletop / presidential mic', 'VQ-MIC-TABLE', 'Venue portal add-on', 'rental', 60, 0, true,
   'venue-catalog:addon-tabletop-mic'),
  ('a1570000-0000-4000-8000-000000000204', 'a1570000-0000-4000-8000-000000000001',
   'Powered speaker', 'VQ-SPK', 'Venue portal add-on', 'rental', 55, 0, true,
   'venue-catalog:addon-powered-speaker'),
  ('a1570000-0000-4000-8000-000000000205', 'a1570000-0000-4000-8000-000000000001',
   'Confidence monitor', 'VQ-CONF', 'Venue portal add-on', 'rental', 150, 0, true,
   'venue-catalog:addon-confidence-monitor'),
  ('a1570000-0000-4000-8000-000000000206', 'a1570000-0000-4000-8000-000000000001',
   'Presentation laptop', 'VQ-LAPTOP', 'Venue portal add-on', 'rental', 75, 0, true,
   'venue-catalog:addon-laptop'),
  ('a1570000-0000-4000-8000-000000000207', 'a1570000-0000-4000-8000-000000000001',
   'HDMI splitter', 'VQ-HDMI-SPLIT', 'Venue portal add-on', 'rental', 10, 0, true,
   'venue-catalog:addon-hdmi-splitter'),
  ('a1570000-0000-4000-8000-000000000208', 'a1570000-0000-4000-8000-000000000001',
   'Slide clicker', 'VQ-CLICKER', 'Venue portal add-on', 'rental', 50, 0, true,
   'venue-catalog:addon-slide-clicker'),
  ('a1570000-0000-4000-8000-000000000209', 'a1570000-0000-4000-8000-000000000001',
   'Wireless uplight', 'VQ-UPLIGHT', 'Venue portal add-on', 'rental', 25, 0, true,
   'venue-catalog:addon-uplight'),
  ('a1570000-0000-4000-8000-000000000210', 'a1570000-0000-4000-8000-000000000001',
   'Table power drop', 'VQ-POWER', 'Venue portal add-on', 'rental', 35, 0, true,
   'venue-catalog:addon-table-power')
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  kind = excluded.kind,
  rental_price = excluded.rental_price,
  is_active = true,
  external_rms_id = excluded.external_rms_id;

insert into public.av_services (
  id, name, code, description, kind, unit_price, is_active, external_rms_id
) values
  ('a1570000-0000-4000-8000-000000000301',
   'On-site technician (hourly)', 'VQ-TECH-HR', 'Venue portal technician hours',
   'crew', 95, true, 'venue-catalog:svc-tech-hourly')
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  unit_price = excluded.unit_price,
  is_active = true,
  external_rms_id = excluded.external_rms_id;

-- Map Hyatt Place Vilano Beach portal rows by name (safe to re-run).
update public.venue_portal_packages p
set av_product_id = m.product_id,
    av_service_id = null
from public.venue_portals v,
lateral (
  select *
  from (
    values
      ('Projector Presentation', 'a1570000-0000-4000-8000-000000000102'::uuid),
      ('Presenter Audio', 'a1570000-0000-4000-8000-000000000103'::uuid),
      ('General Session', 'a1570000-0000-4000-8000-000000000104'::uuid),
      ('Complete Meeting', 'a1570000-0000-4000-8000-000000000101'::uuid)
  ) as t(pkg_name, product_id)
) m
where p.portal_id = v.id
  and v.slug = 'hyatt-place-vilano-beach'
  and p.name = m.pkg_name
  and p.av_product_id is null;

update public.venue_portal_addons a
set av_product_id = m.product_id,
    av_service_id = null
from public.venue_portals v,
lateral (
  select *
  from (
    values
      ('Extra wireless handheld mic', 'a1570000-0000-4000-8000-000000000201'::uuid),
      ('Wireless lapel mic', 'a1570000-0000-4000-8000-000000000202'::uuid),
      ('Tabletop (presidential) mic', 'a1570000-0000-4000-8000-000000000203'::uuid),
      ('Extra powered speaker', 'a1570000-0000-4000-8000-000000000204'::uuid),
      ('Confidence monitor', 'a1570000-0000-4000-8000-000000000205'::uuid),
      ('Laptop', 'a1570000-0000-4000-8000-000000000206'::uuid),
      ('HDMI splitter', 'a1570000-0000-4000-8000-000000000207'::uuid),
      ('Slide clicker', 'a1570000-0000-4000-8000-000000000208'::uuid),
      ('Uplights', 'a1570000-0000-4000-8000-000000000209'::uuid),
      ('Extra table power', 'a1570000-0000-4000-8000-000000000210'::uuid)
  ) as t(addon_name, product_id)
) m
where a.portal_id = v.id
  and v.slug = 'hyatt-place-vilano-beach'
  and a.name = m.addon_name
  and a.av_product_id is null
  and a.av_service_id is null;

update public.venue_portal_addons a
set av_service_id = 'a1570000-0000-4000-8000-000000000301',
    av_product_id = null
from public.venue_portals v
where a.portal_id = v.id
  and v.slug = 'hyatt-place-vilano-beach'
  and a.name = 'On-site technician'
  and a.av_product_id is null
  and a.av_service_id is null;
