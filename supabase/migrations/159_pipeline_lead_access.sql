-- Pipeline CRM mirror: Leads (trainer) can read pipeline data and update
-- Hub project stage. Admin keeps full write (import/delete) and webhook logs.

-- Clients: Lead select
drop policy if exists "pipeline_clients trainer select" on public.pipeline_clients;
create policy "pipeline_clients trainer select"
  on public.pipeline_clients for select to authenticated
  using (public.current_user_role() = 'trainer');

-- Projects: Lead select + update (stage / Hub details)
drop policy if exists "pipeline_projects trainer select" on public.pipeline_projects;
create policy "pipeline_projects trainer select"
  on public.pipeline_projects for select to authenticated
  using (public.current_user_role() = 'trainer');

drop policy if exists "pipeline_projects trainer update" on public.pipeline_projects;
create policy "pipeline_projects trainer update"
  on public.pipeline_projects for update to authenticated
  using (public.current_user_role() = 'trainer')
  with check (public.current_user_role() = 'trainer');

-- Payments: Lead select (history only)
drop policy if exists "pipeline_payments trainer select" on public.pipeline_payments;
create policy "pipeline_payments trainer select"
  on public.pipeline_payments for select to authenticated
  using (public.current_user_role() = 'trainer');

comment on table public.pipeline_projects is
  'Pipeline project mirror (Zapier). Admins full CRUD; Leads select + update Hub stage.';
