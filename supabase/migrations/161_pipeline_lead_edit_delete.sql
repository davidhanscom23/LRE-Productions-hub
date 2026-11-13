-- Pipeline CRM: Leads can update clients and delete clients/projects (Hub SoR).
-- Still no write-back to Pipeline. Admins keep full access via existing policies.

-- Clients: Lead update
drop policy if exists "pipeline_clients trainer update" on public.pipeline_clients;
create policy "pipeline_clients trainer update"
  on public.pipeline_clients for update to authenticated
  using (public.current_user_role() = 'trainer')
  with check (public.current_user_role() = 'trainer');

-- Clients: Lead delete
drop policy if exists "pipeline_clients trainer delete" on public.pipeline_clients;
create policy "pipeline_clients trainer delete"
  on public.pipeline_clients for delete to authenticated
  using (public.current_user_role() = 'trainer');

-- Projects: Lead delete (update already in 159)
drop policy if exists "pipeline_projects trainer delete" on public.pipeline_projects;
create policy "pipeline_projects trainer delete"
  on public.pipeline_projects for delete to authenticated
  using (public.current_user_role() = 'trainer');

comment on table public.pipeline_clients is
  'Pipeline client mirror (Zapier) + Hub-created. Admins and Leads: select/insert/update/delete.';

comment on table public.pipeline_projects is
  'Pipeline project mirror (Zapier) + Hub-created. Admins and Leads: select/insert/update/delete. Stage edits stay in Hub only.';
