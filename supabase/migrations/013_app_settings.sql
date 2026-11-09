-- App-wide settings (admin-only). Used for secrets like the company DJEP iCal URL.

create table public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "Admins can read app settings"
on public.app_settings
for select
to authenticated
using (public.is_admin());

create policy "Admins can insert app settings"
on public.app_settings
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update app settings"
on public.app_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete app settings"
on public.app_settings
for delete
to authenticated
using (public.is_admin());

comment on table public.app_settings is
  'Admin-only key/value settings. Values such as company_ical_url must never be sent to the browser.';
