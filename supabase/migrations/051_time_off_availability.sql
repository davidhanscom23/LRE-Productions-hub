-- 051 Availability & Time-Off
-- Staff submit time-off / unavailability requests; admins approve or deny.
-- Each staffer can also set a weekly availability pattern.

-- ── Time-off requests ────────────────────────────────────────────────
create table if not exists public.time_off_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  type        text not null default 'unavailable'
                check (type in ('vacation','sick','personal','unavailable','other')),
  note        text not null default '',
  status      text not null default 'pending'
                check (status in ('pending','approved','denied','cancelled')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint time_off_valid_range check (end_date >= start_date)
);

create index if not exists time_off_user_idx on public.time_off_requests (user_id);
create index if not exists time_off_status_idx on public.time_off_requests (status);
create index if not exists time_off_dates_idx on public.time_off_requests (start_date, end_date);

-- ── Weekly availability (one row per user) ───────────────────────────
create table if not exists public.staff_availability (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  available_days jsonb not null default '[]'::jsonb,  -- e.g. ["mon","tue","sat","sun"]
  note           text not null default '',
  updated_at     timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.time_off_requests enable row level security;
alter table public.staff_availability enable row level security;

-- Time-off: a user sees their own requests; admins see all. Notes/reasons
-- stay private to the requester + admins. Team-wide "who's off" visibility
-- is provided by list_team_time_off() below (approved dates only, no notes).
drop policy if exists "time_off read own or admin" on public.time_off_requests;
create policy "time_off read own or admin"
  on public.time_off_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "time_off insert own" on public.time_off_requests;
create policy "time_off insert own"
  on public.time_off_requests for insert to authenticated
  with check (user_id = auth.uid());

-- Users may edit/cancel their own request while still pending; admins may
-- update any request (to approve or deny).
drop policy if exists "time_off update own pending or admin" on public.time_off_requests;
create policy "time_off update own pending or admin"
  on public.time_off_requests for update to authenticated
  using ((user_id = auth.uid() and status = 'pending') or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "time_off delete own or admin" on public.time_off_requests;
create policy "time_off delete own or admin"
  on public.time_off_requests for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Availability preferences are low-sensitivity scheduling info: any signed-in
-- staffer can read the team's availability; each person edits only their own.
drop policy if exists "availability read (authenticated)" on public.staff_availability;
create policy "availability read (authenticated)"
  on public.staff_availability for select to authenticated using (true);

drop policy if exists "availability write own or admin" on public.staff_availability;
create policy "availability write own or admin"
  on public.staff_availability for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.time_off_requests to authenticated;
grant select, insert, update, delete on public.staff_availability to authenticated;

-- ── Team time-off (approved only, no private notes) ──────────────────
-- Lets any signed-in staffer see who is approved-off in a date window for
-- scheduling, without exposing sick/personal notes on the raw table.
create or replace function public.list_team_time_off(
  from_date date default (now() - interval '30 days')::date,
  to_date   date default (now() + interval '365 days')::date
)
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  start_date date,
  end_date date,
  type text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.user_id, p.full_name, r.start_date, r.end_date, r.type
  from public.time_off_requests r
  join public.profiles p on p.id = r.user_id
  where r.status = 'approved'
    and r.end_date >= from_date
    and r.start_date <= to_date
  order by r.start_date, p.full_name;
$$;

grant execute on function public.list_team_time_off(date, date) to authenticated;
