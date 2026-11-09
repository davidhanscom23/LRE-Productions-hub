-- Per-user For You dismissals (e.g. monthly trophy congratulations).

create table if not exists public.hub_foryou_dismissals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  dismiss_key text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, dismiss_key)
);

comment on table public.hub_foryou_dismissals is
  'Keys a user has dismissed from For You (informational cards that would otherwise linger).';

create index if not exists hub_foryou_dismissals_user_idx
  on public.hub_foryou_dismissals (user_id);

alter table public.hub_foryou_dismissals enable row level security;

drop policy if exists "Users manage own foryou dismissals"
  on public.hub_foryou_dismissals;
create policy "Users manage own foryou dismissals"
  on public.hub_foryou_dismissals
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.hub_foryou_dismissals to authenticated;
