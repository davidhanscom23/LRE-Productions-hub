-- 060 Per-user Home shortcut tiles.

create table if not exists public.home_shortcuts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  href       text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, href)
);

create index if not exists home_shortcuts_user_idx on public.home_shortcuts (user_id, sort_order);

alter table public.home_shortcuts enable row level security;

drop policy if exists "home_shortcuts own" on public.home_shortcuts;
create policy "home_shortcuts own"
  on public.home_shortcuts for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.home_shortcuts to authenticated;
