-- Ensure Staff Handbook signature table exists (fixes missing-table sign errors).
-- Safe to re-run.

create table if not exists public.handbook_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  signer_name text not null,
  signer_email text not null default '',
  signature_data text not null,
  ip_address text,
  user_agent text,
  handbook_revision text not null default 'draft',
  signed_at timestamptz not null default now(),
  unique (user_id, handbook_revision)
);

create index if not exists handbook_acknowledgements_user_id_idx
  on public.handbook_acknowledgements (user_id);

create index if not exists handbook_acknowledgements_signed_at_idx
  on public.handbook_acknowledgements (signed_at desc);

alter table public.handbook_acknowledgements enable row level security;

drop policy if exists "Users can read own handbook acknowledgements"
  on public.handbook_acknowledgements;
create policy "Users can read own handbook acknowledgements"
on public.handbook_acknowledgements
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('admin', 'trainer')
);

drop policy if exists "Users can insert own handbook acknowledgements"
  on public.handbook_acknowledgements;
create policy "Users can insert own handbook acknowledgements"
on public.handbook_acknowledgements
for insert
to authenticated
with check (user_id = auth.uid());

-- Needed for upsert onConflict (re-sign / overwrite same revision).
drop policy if exists "Users can update own handbook acknowledgements"
  on public.handbook_acknowledgements;
create policy "Users can update own handbook acknowledgements"
on public.handbook_acknowledgements
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

comment on table public.handbook_acknowledgements is
  'Staff digital signatures acknowledging the Staff Handbook.';

-- Guest restrictive denials (same pattern as 042_guest_rls), if helper exists.
do $$
begin
  if to_regprocedure('public.is_guest()') is null then
    raise notice 'skip guest denials: public.is_guest() missing';
    return;
  end if;

  drop policy if exists guests_denied_handbook_acknowledgements_select
    on public.handbook_acknowledgements;
  drop policy if exists guests_denied_handbook_acknowledgements_insert
    on public.handbook_acknowledgements;
  drop policy if exists guests_denied_handbook_acknowledgements_update
    on public.handbook_acknowledgements;
  drop policy if exists guests_denied_handbook_acknowledgements_delete
    on public.handbook_acknowledgements;
  drop policy if exists "Guests denied on handbook_acknowledgements"
    on public.handbook_acknowledgements;

  create policy guests_denied_handbook_acknowledgements_select
  on public.handbook_acknowledgements
  as restrictive
  for select
  to authenticated
  using (not public.is_guest());

  create policy guests_denied_handbook_acknowledgements_insert
  on public.handbook_acknowledgements
  as restrictive
  for insert
  to authenticated
  with check (not public.is_guest());

  create policy guests_denied_handbook_acknowledgements_update
  on public.handbook_acknowledgements
  as restrictive
  for update
  to authenticated
  using (not public.is_guest())
  with check (not public.is_guest());

  create policy guests_denied_handbook_acknowledgements_delete
  on public.handbook_acknowledgements
  as restrictive
  for delete
  to authenticated
  using (not public.is_guest());
end $$;
