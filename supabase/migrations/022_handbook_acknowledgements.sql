-- Staff Handbook digital acknowledgements / signatures

create table public.handbook_acknowledgements (
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

create index handbook_acknowledgements_user_id_idx
  on public.handbook_acknowledgements (user_id);

create index handbook_acknowledgements_signed_at_idx
  on public.handbook_acknowledgements (signed_at desc);

alter table public.handbook_acknowledgements enable row level security;

create policy "Users can read own handbook acknowledgements"
on public.handbook_acknowledgements
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('admin', 'trainer')
);

create policy "Users can insert own handbook acknowledgements"
on public.handbook_acknowledgements
for insert
to authenticated
with check (user_id = auth.uid());

comment on table public.handbook_acknowledgements is
  'Staff digital signatures acknowledging the Staff Handbook.';
