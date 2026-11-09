-- Hub switcher: the four-square button in the top bar lists the company hubs
-- (Vident, Y?, High Five Guys, AI Growth Curve). Each hub keeps its own list of who
-- may see the other hubs' tiles. Admins see every enabled tile; everyone else only
-- sees the hubs an admin ticked for them. The destination hub still checks its own login.

create table if not exists public.hub_links (
  slug        text primary key check (slug ~ '^[a-z0-9-]+$'),
  name        text not null check (length(btrim(name)) > 0),
  url         text not null default '' check (url = '' or url ~* '^https://'),
  logo_url    text not null default '',
  sort_order  int  not null default 100,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.hub_link_access (
  hub_slug    text not null references public.hub_links (slug) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (hub_slug, profile_id)
);

alter table public.hub_links enable row level security;
alter table public.hub_link_access enable row level security;

drop policy if exists "hub links read" on public.hub_links;
create policy "hub links read"
  on public.hub_links for select to authenticated
  using (true);

drop policy if exists "hub links write admin" on public.hub_links;
create policy "hub links write admin"
  on public.hub_links for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "hub link access read own or admin" on public.hub_link_access;
create policy "hub link access read own or admin"
  on public.hub_link_access for select to authenticated
  using (profile_id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "hub link access write admin" on public.hub_link_access;
create policy "hub link access write admin"
  on public.hub_link_access for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

grant select, insert, update, delete on public.hub_links to authenticated;
grant select, insert, update, delete on public.hub_links to service_role;
grant select, insert, update, delete on public.hub_link_access to authenticated;
grant select, insert, update, delete on public.hub_link_access to service_role;

insert into public.hub_links (slug, name, url, sort_order) values
  ('y-entertainment', 'Y? Entertainment Hub', 'https://hub.yentertainmentdjs.com', 10),
  ('high-five-guys', 'High Five Guys Hub', '', 20),
  ('ai-growth-curve', 'AI Growth Curve Hub', '', 30)
on conflict (slug) do nothing;
