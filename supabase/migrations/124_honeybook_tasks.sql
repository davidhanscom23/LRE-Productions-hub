-- HoneyBook tasks mirrored via Zapier → My Week for the assigned Hub user.

create table if not exists public.honeybook_tasks (
  id                   uuid primary key default gen_random_uuid(),
  external_id          text,
  title                text not null default '',
  due_date             date,
  status               text not null default 'open'
                         check (status in ('open', 'done')),
  assignee_email       text not null default '',
  assignee_name        text not null default '',
  assignee_profile_id  uuid references public.profiles(id) on delete set null,
  project_id           uuid references public.honeybook_projects(id) on delete set null,
  client_id            uuid references public.honeybook_clients(id) on delete set null,
  project_name         text not null default '',
  notes                text not null default '',
  source_event         text not null default '',
  raw                  jsonb not null default '{}'::jsonb,
  -- Local Hub mirror only (does not write back to HoneyBook).
  hub_done             boolean not null default false,
  hub_done_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint honeybook_tasks_title_not_blank check (
    char_length(trim(title)) > 0
  )
);

create unique index if not exists honeybook_tasks_external_id_uidx
  on public.honeybook_tasks (external_id)
  where external_id is not null and char_length(trim(external_id)) > 0;

create index if not exists honeybook_tasks_assignee_profile_idx
  on public.honeybook_tasks (assignee_profile_id, status, due_date);

create index if not exists honeybook_tasks_assignee_email_idx
  on public.honeybook_tasks (lower(assignee_email));

create index if not exists honeybook_tasks_due_idx
  on public.honeybook_tasks (due_date);

alter table public.honeybook_tasks enable row level security;

drop policy if exists "honeybook tasks read assignee or admin"
  on public.honeybook_tasks;
create policy "honeybook tasks read assignee or admin"
  on public.honeybook_tasks for select to authenticated
  using (
    public.is_admin()
    or assignee_profile_id = auth.uid()
  );

drop policy if exists "honeybook tasks update assignee or admin"
  on public.honeybook_tasks;
create policy "honeybook tasks update assignee or admin"
  on public.honeybook_tasks for update to authenticated
  using (
    public.is_admin()
    or assignee_profile_id = auth.uid()
  )
  with check (
    public.is_admin()
    or assignee_profile_id = auth.uid()
  );

-- Inserts come from the service role (webhook ingest), not end users.
grant select, update on public.honeybook_tasks to authenticated;
grant select, insert, update, delete on public.honeybook_tasks to service_role;

comment on table public.honeybook_tasks is
  'HoneyBook tasks pushed via Zapier; shown on My Week for the matched Hub assignee.';
