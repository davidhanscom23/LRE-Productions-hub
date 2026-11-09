-- HoneyBook CRM: Leads can update clients and delete clients/projects (Hub SoR).
-- Still no write-back to HoneyBook. Admins keep full access via existing policies.

-- Clients: Lead update
drop policy if exists "honeybook_clients trainer update" on public.honeybook_clients;
create policy "honeybook_clients trainer update"
  on public.honeybook_clients for update to authenticated
  using (public.current_user_role() = 'trainer')
  with check (public.current_user_role() = 'trainer');

-- Clients: Lead delete
drop policy if exists "honeybook_clients trainer delete" on public.honeybook_clients;
create policy "honeybook_clients trainer delete"
  on public.honeybook_clients for delete to authenticated
  using (public.current_user_role() = 'trainer');

-- Projects: Lead delete (update already in 159)
drop policy if exists "honeybook_projects trainer delete" on public.honeybook_projects;
create policy "honeybook_projects trainer delete"
  on public.honeybook_projects for delete to authenticated
  using (public.current_user_role() = 'trainer');

comment on table public.honeybook_clients is
  'HoneyBook client mirror (Zapier) + Hub-created. Admins and Leads: select/insert/update/delete.';

comment on table public.honeybook_projects is
  'HoneyBook project mirror (Zapier) + Hub-created. Admins and Leads: select/insert/update/delete. Stage edits stay in Hub only.';
