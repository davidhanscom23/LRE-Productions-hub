-- HoneyBook CRM mirror: Leads (trainer) can read pipeline data and update
-- Hub project stage. Admin keeps full write (import/delete) and webhook logs.

-- Clients: Lead select
drop policy if exists "honeybook_clients trainer select" on public.honeybook_clients;
create policy "honeybook_clients trainer select"
  on public.honeybook_clients for select to authenticated
  using (public.current_user_role() = 'trainer');

-- Projects: Lead select + update (stage / Hub details)
drop policy if exists "honeybook_projects trainer select" on public.honeybook_projects;
create policy "honeybook_projects trainer select"
  on public.honeybook_projects for select to authenticated
  using (public.current_user_role() = 'trainer');

drop policy if exists "honeybook_projects trainer update" on public.honeybook_projects;
create policy "honeybook_projects trainer update"
  on public.honeybook_projects for update to authenticated
  using (public.current_user_role() = 'trainer')
  with check (public.current_user_role() = 'trainer');

-- Payments: Lead select (history only)
drop policy if exists "honeybook_payments trainer select" on public.honeybook_payments;
create policy "honeybook_payments trainer select"
  on public.honeybook_payments for select to authenticated
  using (public.current_user_role() = 'trainer');

comment on table public.honeybook_projects is
  'HoneyBook project mirror (Zapier). Admins full CRUD; Leads select + update Hub stage.';
