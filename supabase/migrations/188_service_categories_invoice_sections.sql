-- Hub: item categories staff can create/rename/delete (for example DMC categories),
-- and a section name on each project invoice line so invoices can be built in sections.

create table if not exists public.service_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0 and length(name) <= 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists service_categories_name_uidx
  on public.service_categories (lower(btrim(name)));

alter table public.service_categories enable row level security;

drop policy if exists "service categories read staff" on public.service_categories;
create policy "service categories read staff"
  on public.service_categories for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));

drop policy if exists "service categories write admin lead" on public.service_categories;
create policy "service categories write admin lead"
  on public.service_categories for all to authenticated
  using (public.current_user_role() in ('admin', 'trainer'))
  with check (public.current_user_role() in ('admin', 'trainer'));

grant select, insert, update, delete on public.service_categories to authenticated;
grant select, insert, update, delete on public.service_categories to service_role;

alter table public.project_invoice_lines
  add column if not exists section text not null default '';
