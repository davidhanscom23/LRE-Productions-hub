-- Per-venue coordinator password. Venue coordinators must enter it before the
-- venue's partner savings are shown or applied. Stored as a salted scrypt hash
-- in its own admin-only table (NOT readable by regular staff).

create table if not exists public.venue_portal_secrets (
  portal_id                  uuid primary key references public.venue_portals(id) on delete cascade,
  coordinator_password_hash  text,
  updated_at                 timestamptz not null default now()
);

alter table public.venue_portal_secrets enable row level security;

drop policy if exists "venue_portal_secrets admin all" on public.venue_portal_secrets;
create policy "venue_portal_secrets admin all"
on public.venue_portal_secrets for all to authenticated
using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.venue_portal_secrets to authenticated;
grant select, insert, update, delete on public.venue_portal_secrets to service_role;
