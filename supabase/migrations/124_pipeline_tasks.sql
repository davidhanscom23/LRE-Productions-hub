-- Pipeline tasks mirrored via Zapier → My Week for the assigned Hub user.

create table if not exists public.pipeline_tasks (
  id                   uuid primary key default gen_random_uuid(),
  external_id          text,
  title                text not null default '',
  due_date             date,
  status               text not null default 'open'
                         check (status in ('open', 'done')),
  assignee_email       text not null default '',
  assignee_name        text not null default '',
  assignee_profile_id  uuid references public.profiles(id) on delete set null,
  project_id           uuid references public.pipeline_projects(id) on delete set null,
  client_id            uuid references public.pipeline_clients(id) on delete set null,
  project_name         text not null default '',
  notes                text not null default '',
  source_event         text not null default '',
  raw                  jsonb not null default '{}'::jsonb,
  -- Local Hub mirror only (does not write back to Pipeline).
  hub_done             boolean not null default false,
  hub_done_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint pipeline_tasks_title_not_blank check (
    char_length(trim(title)) > 0
  )
);

create unique index if not exists pipeline_tasks_external_id_uidx
  on public.pipeline_tasks (external_id)
  where external_id is not null and char_length(trim(external_id)) > 0;

create index if not exists pipeline_tasks_assignee_profile_idx
  on public.pipeline_tasks (assignee_profile_id, status, due_date);

create index if not exists pipeline_tasks_assignee_email_idx
  on public.pipeline_tasks (lower(assignee_email));

create index if not exists pipeline_tasks_due_idx
  on public.pipeline_tasks (due_date);

alter table public.pipeline_tasks enable row level security;

drop policy if exists "pipeline tasks read assignee or admin"
  on public.pipeline_tasks;
create policy "pipeline tasks read assignee or admin"
  on public.pipeline_tasks for select to authenticated
  using (
    public.is_admin()
    or assignee_profile_id = auth.uid()
  );

drop policy if exists "pipeline tasks update assignee or admin"
  on public.pipeline_tasks;
create policy "pipeline tasks update assignee or admin"
  on public.pipeline_tasks for update to authenticated
  using (
    public.is_admin()
    or assignee_profile_id = auth.uid()
  )
  with check (
    public.is_admin()
    or assignee_profile_id = auth.uid()
  );

-- Inserts come from the service role (webhook ingest), not end users.
grant select, update on public.pipeline_tasks to authenticated;
grant select, insert, update, delete on public.pipeline_tasks to service_role;

comment on table public.pipeline_tasks is
  'Pipeline tasks pushed via Zapier; shown on My Week for the matched Hub assignee.';
