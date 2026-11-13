-- Pipeline CRM mirror: clients, projects (any stage), payments.
-- Synced via Zapier webhooks (no public Pipeline API). Admin-only UI.

create table if not exists public.pipeline_clients (
  id            uuid primary key default gen_random_uuid(),
  external_id   text,
  full_name     text not null default '',
  email         text not null default '',
  phone         text not null default '',
  address       text not null default '',
  source_event  text not null default '',
  raw           jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint pipeline_clients_name_or_email check (
    char_length(trim(full_name)) > 0 or char_length(trim(email)) > 0
  )
);

-- Prefer Pipeline/Zapier id when present; else unique on lower(email) for imports.
create unique index if not exists pipeline_clients_external_id_uidx
  on public.pipeline_clients (external_id)
  where external_id is not null and char_length(trim(external_id)) > 0;

create unique index if not exists pipeline_clients_email_uidx
  on public.pipeline_clients (lower(email))
  where external_id is null and char_length(trim(email)) > 0;

create index if not exists pipeline_clients_name_idx
  on public.pipeline_clients (full_name);

create table if not exists public.pipeline_projects (
  id                  uuid primary key default gen_random_uuid(),
  external_id         text,
  client_id           uuid references public.pipeline_clients(id) on delete set null,
  name                text not null default '',
  stage               text not null default '',
  project_type        text not null default '',
  project_date        date,
  budget              numeric(12, 2),
  location            text not null default '',
  details             text not null default '',
  booked_at           timestamptz,
  source_event        text not null default '',
  raw                 jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint pipeline_projects_name_not_blank check (char_length(trim(name)) > 0)
);

create unique index if not exists pipeline_projects_external_id_uidx
  on public.pipeline_projects (external_id)
  where external_id is not null and char_length(trim(external_id)) > 0;

create index if not exists pipeline_projects_stage_idx
  on public.pipeline_projects (stage);

create index if not exists pipeline_projects_client_idx
  on public.pipeline_projects (client_id);

create index if not exists pipeline_projects_date_idx
  on public.pipeline_projects (project_date);

create table if not exists public.pipeline_payments (
  id                  uuid primary key default gen_random_uuid(),
  external_id         text,
  client_id           uuid references public.pipeline_clients(id) on delete set null,
  project_id          uuid references public.pipeline_projects(id) on delete set null,
  amount              numeric(12, 2) not null default 0,
  currency            text not null default 'USD',
  paid_at             timestamptz,
  note                text not null default '',
  source_event        text not null default '',
  raw                 jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists pipeline_payments_external_id_uidx
  on public.pipeline_payments (external_id)
  where external_id is not null and char_length(trim(external_id)) > 0;

create index if not exists pipeline_payments_paid_at_idx
  on public.pipeline_payments (paid_at desc);

create index if not exists pipeline_payments_project_idx
  on public.pipeline_payments (project_id);

-- Dedup / audit log for Zapier deliveries.
create table if not exists public.pipeline_webhook_events (
  id            uuid primary key default gen_random_uuid(),
  event_type    text not null default '',
  idempotency_key text,
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'ok'
                  check (status in ('ok', 'error', 'ignored')),
  error_message text not null default '',
  created_at    timestamptz not null default now()
);

create unique index if not exists pipeline_webhook_events_idem_uidx
  on public.pipeline_webhook_events (idempotency_key)
  where idempotency_key is not null and char_length(trim(idempotency_key)) > 0;

create index if not exists pipeline_webhook_events_created_idx
  on public.pipeline_webhook_events (created_at desc);

alter table public.pipeline_clients enable row level security;
alter table public.pipeline_projects enable row level security;
alter table public.pipeline_payments enable row level security;
alter table public.pipeline_webhook_events enable row level security;

drop policy if exists "pipeline_clients admin all" on public.pipeline_clients;
create policy "pipeline_clients admin all"
  on public.pipeline_clients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pipeline_projects admin all" on public.pipeline_projects;
create policy "pipeline_projects admin all"
  on public.pipeline_projects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pipeline_payments admin all" on public.pipeline_payments;
create policy "pipeline_payments admin all"
  on public.pipeline_payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pipeline_webhook_events admin select" on public.pipeline_webhook_events;
create policy "pipeline_webhook_events admin select"
  on public.pipeline_webhook_events for select to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.pipeline_clients to authenticated;
grant select, insert, update, delete on public.pipeline_projects to authenticated;
grant select, insert, update, delete on public.pipeline_payments to authenticated;
grant select on public.pipeline_webhook_events to authenticated;

grant select, insert, update, delete on public.pipeline_clients to service_role;
grant select, insert, update, delete on public.pipeline_projects to service_role;
grant select, insert, update, delete on public.pipeline_payments to service_role;
grant select, insert, update, delete on public.pipeline_webhook_events to service_role;
