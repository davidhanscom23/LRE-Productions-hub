-- Vendors directory: Hub source of truth with audit history + delete requests.

create table if not exists public.vendors (
  id              uuid primary key default gen_random_uuid(),
  category        text not null default '',
  company_name    text not null default '',
  contact_name    text not null default '',
  phone           text not null default '',
  email           text not null default '',
  website         text not null default '',
  notes           text not null default '',
  preferred       boolean not null default false,
  departments     text[] not null default '{}',
  created_by      uuid references public.profiles(id) on delete set null,
  updated_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint vendors_company_not_blank check (char_length(trim(company_name)) > 0)
);

create index if not exists vendors_company_idx on public.vendors (company_name);
create index if not exists vendors_category_idx on public.vendors (category);
create index if not exists vendors_preferred_idx on public.vendors (preferred);

create table if not exists public.vendor_audit_events (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid references public.vendors(id) on delete set null,
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,
  summary      text not null default '',
  before_row   jsonb,
  after_row    jsonb,
  created_at   timestamptz not null default now(),
  constraint vendor_audit_action_check check (
    action in (
      'create',
      'update',
      'delete',
      'delete_request',
      'delete_approve',
      'delete_decline'
    )
  )
);

create index if not exists vendor_audit_vendor_idx
  on public.vendor_audit_events (vendor_id, created_at desc);
create index if not exists vendor_audit_created_idx
  on public.vendor_audit_events (created_at desc);

create table if not exists public.vendor_delete_requests (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references public.vendors(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  reason       text not null default '',
  status       text not null default 'pending',
  reviewed_by  uuid references public.profiles(id) on delete set null,
  review_note  text not null default '',
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  constraint vendor_delete_status_check check (
    status in ('pending', 'approved', 'declined')
  )
);

create unique index if not exists vendor_delete_requests_pending_uidx
  on public.vendor_delete_requests (vendor_id)
  where status = 'pending';

alter table public.vendors enable row level security;
alter table public.vendor_audit_events enable row level security;
alter table public.vendor_delete_requests enable row level security;

drop policy if exists "vendors read (non-guest)" on public.vendors;
create policy "vendors read (non-guest)"
  on public.vendors for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role is distinct from 'guest'
  ));

drop policy if exists "vendors insert (non-guest)" on public.vendors;
create policy "vendors insert (non-guest)"
  on public.vendors for insert to authenticated
  with check (public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'trainer', 'staff')
  ));

drop policy if exists "vendors update (non-guest)" on public.vendors;
create policy "vendors update (non-guest)"
  on public.vendors for update to authenticated
  using (public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'trainer', 'staff')
  ))
  with check (public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'trainer', 'staff')
  ));

drop policy if exists "vendors delete (admin)" on public.vendors;
create policy "vendors delete (admin)"
  on public.vendors for delete to authenticated
  using (public.is_admin());

drop policy if exists "vendor audit read (non-guest)" on public.vendor_audit_events;
create policy "vendor audit read (non-guest)"
  on public.vendor_audit_events for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role is distinct from 'guest'
  ));

drop policy if exists "vendor audit insert (non-guest)" on public.vendor_audit_events;
create policy "vendor audit insert (non-guest)"
  on public.vendor_audit_events for insert to authenticated
  with check (public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'trainer', 'staff')
  ));

drop policy if exists "vendor delete requests read" on public.vendor_delete_requests;
create policy "vendor delete requests read"
  on public.vendor_delete_requests for select to authenticated
  using (
    public.is_admin()
    or requested_by = auth.uid()
  );

drop policy if exists "vendor delete requests insert" on public.vendor_delete_requests;
create policy "vendor delete requests insert"
  on public.vendor_delete_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'trainer', 'staff')
    )
  );

drop policy if exists "vendor delete requests update (admin)" on public.vendor_delete_requests;
create policy "vendor delete requests update (admin)"
  on public.vendor_delete_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.vendors to authenticated;
grant select, insert on public.vendor_audit_events to authenticated;
grant select, insert, update on public.vendor_delete_requests to authenticated;
grant select, insert, update, delete on public.vendors to service_role;
grant select, insert, update, delete on public.vendor_audit_events to service_role;
grant select, insert, update, delete on public.vendor_delete_requests to service_role;
