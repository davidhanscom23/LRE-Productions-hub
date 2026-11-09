-- HoneyBook replacement: automated client emails (thank you / review request, post-event
-- check-in, proposal nudge). Every automation ships OFF; an admin turns each on.

create table if not exists public.honeybook_automations (
  key         text primary key,
  enabled     boolean not null default false,
  delay_days  integer not null default 3 check (delay_days between 0 and 730),
  subject     text not null,
  body        text not null,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.honeybook_automation_runs (
  id             uuid primary key default gen_random_uuid(),
  automation_key text not null references public.honeybook_automations (key) on delete cascade,
  project_id     uuid not null references public.honeybook_projects (id) on delete cascade,
  sent_to        text not null default '',
  status         text not null check (status in ('sent', 'failed', 'skipped')),
  error          text not null default '',
  created_at     timestamptz not null default now(),
  -- One send per automation per project, ever. The cron inserts this row BEFORE sending.
  constraint honeybook_automation_runs_once unique (automation_key, project_id)
);

create index if not exists honeybook_automation_runs_created_idx
  on public.honeybook_automation_runs (created_at desc);

alter table public.honeybook_automations enable row level security;
alter table public.honeybook_automation_runs enable row level security;

drop policy if exists "hb automations admin" on public.honeybook_automations;
create policy "hb automations admin"
  on public.honeybook_automations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "hb automation runs admin read" on public.honeybook_automation_runs;
create policy "hb automation runs admin read"
  on public.honeybook_automation_runs for select to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.honeybook_automations to authenticated;
grant select, insert, update, delete on public.honeybook_automations to service_role;
grant select on public.honeybook_automation_runs to authenticated;
grant select, insert, update, delete on public.honeybook_automation_runs to service_role;

insert into public.honeybook_automations (key, enabled, delay_days, subject, body) values
  ('thank_you_review', false, 3,
   'Thank you from Vident Productions',
   E'Hi {{first_name}},\n\nThank you for letting us be part of {{project_name}}. It was a true pleasure, and we hope it was everything you imagined.\n\nIf you have a minute, a short review would mean the world to our team. We read every one.\n\nWith appreciation,\n{{sender_name}}\nVident Productions'),
  ('followup_90day', false, 90,
   'Checking in after {{project_name}}',
   E'Hi {{first_name}},\n\nIt has been a little while since {{project_name}}, and we wanted to say hello and see how everything is going. If you have another event coming up, or know someone planning one, we would love to help.\n\nWarmly,\n{{sender_name}}\nVident Productions'),
  ('proposal_nudge', false, 5,
   'Following up on your proposal for {{project_name}}',
   E'Hi {{first_name}},\n\nI wanted to check in on the proposal we sent for {{project_name}}. Do you have any questions, or anything you would like us to adjust? We are happy to tailor it so it is perfect for you.\n\n{{sender_name}}\nVident Productions')
on conflict (key) do nothing;
