-- Public read-only share link for Pipeline / Hub CRM projects (client-facing).

alter table public.pipeline_projects
  add column if not exists share_token text,
  add column if not exists share_enabled boolean not null default false;

comment on column public.pipeline_projects.share_token is
  'Opaque token for /project/<token> public read-only CRM project page.';
comment on column public.pipeline_projects.share_enabled is
  'When true and share_token is set, the public project link is live.';

create unique index if not exists pipeline_projects_share_token_key
  on public.pipeline_projects (share_token)
  where share_token is not null;
