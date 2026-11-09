-- 094 Pebbles & Rocks. Per-person quarterly priorities.
-- "Rocks" = the big quarterly priorities (from the EOS/Traction method).
-- "Pebbles" = the smaller supporting tasks that move a rock forward.

create table if not exists public.quarterly_goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  year       int  not null,
  quarter    int  not null check (quarter between 1 and 4),
  kind       text not null check (kind in ('rock','pebble')),
  title      text not null default '',
  detail     text not null default '',
  status     text not null default 'not_started'
               check (status in ('not_started','on_track','at_risk','done')),
  sort_order int  not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quarterly_goals_title_not_blank check (char_length(trim(title)) > 0)
);

create index if not exists quarterly_goals_user_idx
  on public.quarterly_goals (user_id, year, quarter);

alter table public.quarterly_goals enable row level security;

-- Read: any authenticated user (the board is transparent across the team).
drop policy if exists "quarterly_goals read" on public.quarterly_goals;
create policy "quarterly_goals read"
  on public.quarterly_goals for select to authenticated using (true);

-- Write: admins manage anyone's board; a user manages their own.
drop policy if exists "quarterly_goals insert" on public.quarterly_goals;
create policy "quarterly_goals insert"
  on public.quarterly_goals for insert to authenticated
  with check (public.is_admin() or user_id = auth.uid());

drop policy if exists "quarterly_goals update" on public.quarterly_goals;
create policy "quarterly_goals update"
  on public.quarterly_goals for update to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

drop policy if exists "quarterly_goals delete" on public.quarterly_goals;
create policy "quarterly_goals delete"
  on public.quarterly_goals for delete to authenticated
  using (public.is_admin() or user_id = auth.uid());

grant select, insert, update, delete on public.quarterly_goals to authenticated;
