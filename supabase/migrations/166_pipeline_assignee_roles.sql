-- Project lead vs support staff on Hub CRM assignees.

alter table public.pipeline_project_assignees
  add column if not exists role text not null default 'support';

alter table public.pipeline_project_assignees
  drop constraint if exists pipeline_project_assignees_role_check;

alter table public.pipeline_project_assignees
  add constraint pipeline_project_assignees_role_check
  check (role in ('lead', 'support'));

-- At most one project lead per project.
create unique index if not exists pipeline_project_assignees_one_lead_uidx
  on public.pipeline_project_assignees (project_id)
  where role = 'lead';

comment on column public.pipeline_project_assignees.role is
  'lead = primary owner of the project; support = additional staff.';
