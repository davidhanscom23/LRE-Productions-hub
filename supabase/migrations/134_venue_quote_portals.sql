-- Venue quote portals: public, link-only instant-estimate pages (/quote/[slug])
-- with per-venue spaces, packages, add-ons, enhancements, and quote requests.
--
-- Access model: all tables are admin-managed (RLS). The public page and the
-- public submit action read/write through the server-side service-role client,
-- and only ever expose rows where venue_portals.is_published = true. There are
-- deliberately NO anon policies.

create table if not exists public.venue_portals (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null,
  name                text not null,
  headline            text not null default 'Build your AV package',
  intro               text not null default '',
  hero_image_url      text,
  logo_url            text,
  accent_color        text not null default '#b08a4a',
  event_types         text[] not null default array[
                        'Conference','Corporate Meeting','Wedding','Gala',
                        'Trade Show','Concert','Private Event','Other'],
  default_start_time  time not null default '18:00',
  default_end_time    time not null default '22:00',
  -- Per-venue rates
  delivery_fee        numeric(10,2) not null default 0 check (delivery_fee >= 0),
  tech_hourly_rate    numeric(10,2) not null default 0 check (tech_hourly_rate >= 0),
  savings_label       text not null default 'Partner Savings',
  savings_pct         numeric(5,2) not null default 0
                        check (savings_pct >= 0 and savings_pct <= 100),
  -- Where "request a quote" notifications go (falls back to hub default)
  notify_email        text,
  is_published        boolean not null default false,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint venue_portals_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  constraint venue_portals_name_not_blank check (char_length(trim(name)) > 0)
);
create unique index if not exists venue_portals_slug_key on public.venue_portals (slug);

create table if not exists public.venue_portal_spaces (
  id               uuid primary key default gen_random_uuid(),
  portal_id        uuid not null references public.venue_portals(id) on delete cascade,
  name             text not null,
  image_url        text,
  capacity         integer check (capacity is null or capacity > 0),
  is_custom_quote  boolean not null default false,
  sort_order       integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists venue_portal_spaces_portal_idx
  on public.venue_portal_spaces (portal_id, sort_order);

create table if not exists public.venue_portal_packages (
  id                   uuid primary key default gen_random_uuid(),
  portal_id            uuid not null references public.venue_portals(id) on delete cascade,
  name                 text not null,
  tagline              text not null default '',
  price                numeric(10,2) not null default 0 check (price >= 0),
  setup_fee            numeric(10,2) not null default 0 check (setup_fee >= 0),
  includes_technician  boolean not null default false,
  is_popular           boolean not null default false,
  sort_order           integer not null default 0,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists venue_portal_packages_portal_idx
  on public.venue_portal_packages (portal_id, sort_order);

create table if not exists public.venue_portal_package_items (
  id          uuid primary key default gen_random_uuid(),
  package_id  uuid not null references public.venue_portal_packages(id) on delete cascade,
  label       text not null,
  sort_order  integer not null default 0
);
create index if not exists venue_portal_package_items_pkg_idx
  on public.venue_portal_package_items (package_id, sort_order);

create table if not exists public.venue_portal_addons (
  id            uuid primary key default gen_random_uuid(),
  portal_id     uuid not null references public.venue_portals(id) on delete cascade,
  name          text not null,
  description   text not null default '',
  image_url     text,
  unit_price    numeric(10,2) not null default 0 check (unit_price >= 0),
  price_unit    text not null default 'each' check (price_unit in ('each','flat','hour')),
  min_quantity  integer not null default 0 check (min_quantity >= 0),
  max_quantity  integer check (max_quantity is null or max_quantity > 0),
  -- Add-on that is bundled in packages; shown but not orderable (e.g. clicker).
  is_orderable  boolean not null default true,
  note          text not null default '',
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists venue_portal_addons_portal_idx
  on public.venue_portal_addons (portal_id, sort_order);

-- Cross-sell cards ("I'm interested"); not priced, never added to the AV total.
create table if not exists public.venue_portal_enhancements (
  id           uuid primary key default gen_random_uuid(),
  portal_id    uuid not null references public.venue_portals(id) on delete cascade,
  name         text not null,
  description  text not null default '',
  image_url    text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists venue_portal_enhancements_portal_idx
  on public.venue_portal_enhancements (portal_id, sort_order);

-- Submitted requests. `totals` is a server-computed snapshot so a later price
-- change never rewrites what the client was shown.
create table if not exists public.venue_portal_quote_requests (
  id                uuid primary key default gen_random_uuid(),
  portal_id         uuid not null references public.venue_portals(id) on delete restrict,
  submit_kind       text not null default 'quote' check (submit_kind in ('quote','book')),
  requester_role    text not null default 'planner'
                      check (requester_role in ('venue_coordinator','planner')),
  contact_first     text not null default '',
  contact_last      text not null default '',
  contact_email     text not null default '',
  contact_phone     text not null default '',
  client_first      text not null default '',
  client_last       text not null default '',
  client_email      text not null default '',
  client_phone      text not null default '',
  event_type        text not null default '',
  guest_count       integer,
  event_days        jsonb not null default '[]'::jsonb,
  selection         jsonb not null default '[]'::jsonb,
  enhancement_ids   uuid[] not null default '{}',
  notes             text not null default '',
  totals            jsonb not null default '{}'::jsonb,
  status            text not null default 'new'
                      check (status in ('new','contacted','quoted','booked','lost')),
  assigned_to       uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists venue_portal_quote_requests_portal_idx
  on public.venue_portal_quote_requests (portal_id, created_at desc);
create index if not exists venue_portal_quote_requests_status_idx
  on public.venue_portal_quote_requests (status, created_at desc);

-- updated_at triggers (shared helper)
do $$
declare t text;
begin
  foreach t in array array[
    'venue_portals','venue_portal_spaces','venue_portal_packages',
    'venue_portal_addons','venue_portal_enhancements','venue_portal_quote_requests'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end $$;

-- RLS: admins manage everything; non-guest staff can read requests/portals.
do $$
declare t text;
begin
  foreach t in array array[
    'venue_portals','venue_portal_spaces','venue_portal_packages',
    'venue_portal_package_items','venue_portal_addons',
    'venue_portal_enhancements','venue_portal_quote_requests'
  ] loop
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
