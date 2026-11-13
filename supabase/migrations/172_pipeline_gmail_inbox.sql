-- Gmail inbox monitoring for the Pipeline CRM (Projects tab):
--   * pipeline_project_notes: the running trail on each project card
--     (manual notes + notes the Hub writes from staff email threads)
--   * pipeline_gmail_messages: ledger of every message the Hub looked at, so
--     nothing is processed twice (stores NO message content)
--   * pipeline_gmail_sync_state: per-mailbox watermark + last error
--   * pipeline_digest_runs: once-per-day guard for the daily update emails

-- ---------------------------------------------------------------------------
-- Project notes (the trail)
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_project_notes (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.pipeline_projects (id) on delete cascade,
  author_id         uuid references public.profiles (id) on delete set null,
  source            text not null default 'manual'
                      check (source in ('manual', 'gmail', 'system')),
  category          text not null default 'note'
                      check (category in ('note', 'email', 'change', 'action', 'status')),
  body              text not null,
  -- Staff mailbox the email was seen in (gmail source only).
  mailbox           text not null default '',
  gmail_thread_id   text,
  -- RFC 822 Message-ID (stable across mailboxes) so two staff on one chain log once.
  message_key       text,
  -- "Someone needs to do something about this" flag; shows in the daily update.
  needs_action      boolean not null default false,
  action_done_at    timestamptz,
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  constraint pipeline_project_notes_body_not_blank check (char_length(trim(body)) > 0)
);

create unique index if not exists pipeline_project_notes_message_key_uidx
  on public.pipeline_project_notes (message_key)
  where message_key is not null;

create index if not exists pipeline_project_notes_project_idx
  on public.pipeline_project_notes (project_id, occurred_at desc);

create index if not exists pipeline_project_notes_open_actions_idx
  on public.pipeline_project_notes (project_id)
  where needs_action and action_done_at is null;

comment on table public.pipeline_project_notes is
  'Running trail on a Hub CRM project card: staff notes plus summaries of email threads the Hub sees in staff Gmail.';

alter table public.pipeline_project_notes enable row level security;

drop policy if exists "pipeline_notes select" on public.pipeline_project_notes;
create policy "pipeline_notes select"
  on public.pipeline_project_notes for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));

drop policy if exists "pipeline_notes admin all" on public.pipeline_project_notes;
create policy "pipeline_notes admin all"
  on public.pipeline_project_notes for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Leads and staff can add manual notes on projects they are assigned to.
drop policy if exists "pipeline_notes assignee insert" on public.pipeline_project_notes;
create policy "pipeline_notes assignee insert"
  on public.pipeline_project_notes for insert to authenticated
  with check (
    public.current_user_role() in ('trainer', 'staff')
    and source = 'manual'
    and author_id = auth.uid()
    and exists (
      select 1 from public.pipeline_project_assignees a
      where a.project_id = pipeline_project_notes.project_id
        and a.profile_id = auth.uid()
    )
  );

-- Assignees can mark an action done on their projects.
drop policy if exists "pipeline_notes assignee update" on public.pipeline_project_notes;
create policy "pipeline_notes assignee update"
  on public.pipeline_project_notes for update to authenticated
  using (
    public.current_user_role() in ('trainer', 'staff')
    and exists (
      select 1 from public.pipeline_project_assignees a
      where a.project_id = pipeline_project_notes.project_id
        and a.profile_id = auth.uid()
    )
  )
  with check (
    public.current_user_role() in ('trainer', 'staff')
    and exists (
      select 1 from public.pipeline_project_assignees a
      where a.project_id = pipeline_project_notes.project_id
        and a.profile_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.pipeline_project_notes to authenticated;
grant select, insert, update, delete on public.pipeline_project_notes to service_role;

-- ---------------------------------------------------------------------------
-- Gmail ledger (no message content stored here)
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_gmail_messages (
  message_key   text primary key,
  mailbox       text not null,
  gmail_id      text not null,
  thread_id     text not null,
  outcome       text not null
                  check (outcome in ('inquiry', 'note', 'no_change', 'ignored', 'error')),
  project_id    uuid references public.pipeline_projects (id) on delete set null,
  processed_at  timestamptz not null default now()
);

create index if not exists pipeline_gmail_messages_mailbox_idx
  on public.pipeline_gmail_messages (mailbox, processed_at desc);

-- (mailbox, thread) -> project, so later replies in a thread land on the same card.
create table if not exists public.pipeline_gmail_threads (
  mailbox     text not null,
  thread_id   text not null,
  project_id  uuid not null references public.pipeline_projects (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (mailbox, thread_id)
);

create index if not exists pipeline_gmail_threads_project_idx
  on public.pipeline_gmail_threads (project_id);

alter table public.pipeline_gmail_messages enable row level security;
alter table public.pipeline_gmail_threads enable row level security;

drop policy if exists "pipeline_gmail_messages admin select" on public.pipeline_gmail_messages;
create policy "pipeline_gmail_messages admin select"
  on public.pipeline_gmail_messages for select to authenticated
  using (public.is_admin());

drop policy if exists "pipeline_gmail_threads admin select" on public.pipeline_gmail_threads;
create policy "pipeline_gmail_threads admin select"
  on public.pipeline_gmail_threads for select to authenticated
  using (public.is_admin());

grant select on public.pipeline_gmail_messages to authenticated;
grant select on public.pipeline_gmail_threads to authenticated;
grant select, insert, update, delete on public.pipeline_gmail_messages to service_role;
grant select, insert, update, delete on public.pipeline_gmail_threads to service_role;

-- ---------------------------------------------------------------------------
-- Per-mailbox sync state
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_gmail_sync_state (
  mailbox         text primary key,
  -- Newest message internalDate (ms since epoch) fully processed.
  last_internal_ms bigint not null default 0,
  last_run_at     timestamptz,
  last_error      text not null default '',
  updated_at      timestamptz not null default now()
);

alter table public.pipeline_gmail_sync_state enable row level security;

drop policy if exists "pipeline_gmail_sync_state admin select" on public.pipeline_gmail_sync_state;
create policy "pipeline_gmail_sync_state admin select"
  on public.pipeline_gmail_sync_state for select to authenticated
  using (public.is_admin());

grant select on public.pipeline_gmail_sync_state to authenticated;
grant select, insert, update, delete on public.pipeline_gmail_sync_state to service_role;

-- ---------------------------------------------------------------------------
-- Daily update guard (one run per calendar day, Eastern time)
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_digest_runs (
  run_date     date primary key,
  started_at   timestamptz not null default now(),
  staff_emailed integer not null default 0,
  admin_emailed boolean not null default false
);

alter table public.pipeline_digest_runs enable row level security;

drop policy if exists "pipeline_digest_runs admin select" on public.pipeline_digest_runs;
create policy "pipeline_digest_runs admin select"
  on public.pipeline_digest_runs for select to authenticated
  using (public.is_admin());

grant select on public.pipeline_digest_runs to authenticated;
grant select, insert, update, delete on public.pipeline_digest_runs to service_role;
