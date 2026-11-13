-- Proposals: branded PDF from Ready quotes → Drive + Pipeline project link.

create table if not exists public.proposals (
  id                    uuid primary key default gen_random_uuid(),
  quote_id              uuid references public.quotes(id) on delete set null,
  created_by            uuid not null references public.profiles(id) on delete cascade,
  client_name           text not null default '',
  event_name            text not null default '',
  event_date            date,
  department            text not null default 'General',
  title                 text not null default 'Proposal',
  intro                 text not null default '',
  notes                 text not null default '',
  status                text not null default 'draft'
                          check (status in (
                            'draft',
                            'generated',
                            'uploaded',
                            'linked'
                          )),
  list_total            numeric(12,2) not null default 0,
  quote_total           numeric(12,2) not null default 0,
  lines_snapshot        jsonb not null default '[]'::jsonb,
  drive_file_id         text,
  drive_web_view_link   text not null default '',
  drive_folder_path     text not null default '',
  pipeline_project_id  uuid references public.pipeline_projects(id) on delete set null,
  pipeline_linked_at   timestamptz,
  generated_at          timestamptz,
  uploaded_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists proposals_created_by_idx on public.proposals (created_by);
create index if not exists proposals_quote_idx on public.proposals (quote_id);
create index if not exists proposals_status_idx on public.proposals (status);
create index if not exists proposals_hb_idx on public.proposals (pipeline_project_id);
create index if not exists proposals_updated_idx on public.proposals (updated_at desc);

alter table public.proposals enable row level security;

drop policy if exists "proposals read own or admin" on public.proposals;
create policy "proposals read own or admin"
  on public.proposals for select to authenticated
  using (created_by = auth.uid() or public.is_admin());

drop policy if exists "proposals insert own" on public.proposals;
create policy "proposals insert own"
  on public.proposals for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "proposals update own or admin" on public.proposals;
create policy "proposals update own or admin"
  on public.proposals for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "proposals delete own or admin" on public.proposals;
create policy "proposals delete own or admin"
  on public.proposals for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.proposals to authenticated;

comment on table public.proposals is
  'Branded proposals generated from Ready quotes; PDF stored on Google Drive and optionally linked to a Pipeline project.';
