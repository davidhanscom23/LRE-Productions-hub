-- Client questionnaire answers for shared Hub CRM projects (/project/[token]).
-- Public writes go through service role in server actions; staff read via RLS.

create table if not exists public.pipeline_project_questionnaire_answers (
  project_id    uuid primary key references public.pipeline_projects (id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb,
  submitted_at  timestamptz,
  updated_at    timestamptz not null default now(),
  constraint pipeline_project_questionnaire_answers_is_object
    check (jsonb_typeof(answers) = 'object')
);

comment on table public.pipeline_project_questionnaire_answers is
  'Client questionnaire answers for a Hub CRM project share link (one row per project).';

alter table public.pipeline_project_questionnaire_answers enable row level security;

drop policy if exists "hb_q_answers select hb"
  on public.pipeline_project_questionnaire_answers;
create policy "hb_q_answers select hb"
  on public.pipeline_project_questionnaire_answers for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));

drop policy if exists "hb_q_answers admin all"
  on public.pipeline_project_questionnaire_answers;
create policy "hb_q_answers admin all"
  on public.pipeline_project_questionnaire_answers for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "hb_q_answers trainer write"
  on public.pipeline_project_questionnaire_answers;
create policy "hb_q_answers trainer write"
  on public.pipeline_project_questionnaire_answers for all to authenticated
  using (public.current_user_role() = 'trainer')
  with check (public.current_user_role() = 'trainer');

grant select, insert, update, delete
  on public.pipeline_project_questionnaire_answers to authenticated;
grant select, insert, update, delete
  on public.pipeline_project_questionnaire_answers to service_role;
