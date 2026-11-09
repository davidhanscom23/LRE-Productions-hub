-- Hub service catalog: the saved services/prices that HoneyBook kept, so invoices and
-- proposals can pick from them. Everyone on staff can read; admins and Leads edit.

create table if not exists public.service_catalog_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  description text not null default '',
  category    text not null default 'Other',
  unit_price  numeric(10, 2) not null default 0 check (unit_price >= 0),
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists service_catalog_items_name_uidx
  on public.service_catalog_items (lower(btrim(name)));
create index if not exists service_catalog_items_category_idx
  on public.service_catalog_items (category, name);

alter table public.service_catalog_items enable row level security;

drop policy if exists "service catalog read staff" on public.service_catalog_items;
create policy "service catalog read staff"
  on public.service_catalog_items for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));

drop policy if exists "service catalog write admin lead" on public.service_catalog_items;
create policy "service catalog write admin lead"
  on public.service_catalog_items for all to authenticated
  using (public.current_user_role() in ('admin', 'trainer'))
  with check (public.current_user_role() in ('admin', 'trainer'));

grant select, insert, update, delete on public.service_catalog_items to authenticated;
grant select, insert, update, delete on public.service_catalog_items to service_role;
