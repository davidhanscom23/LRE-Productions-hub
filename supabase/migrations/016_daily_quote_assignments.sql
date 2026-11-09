-- Daily motivational quote assignments for My Week.
-- One quote per user per day; the same quote cannot be assigned to two users on the same day.

create table public.daily_quote_assignments (
  day date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  quote_index integer not null check (quote_index >= 0),
  created_at timestamptz not null default now(),
  primary key (day, user_id),
  unique (day, quote_index)
);

create index daily_quote_assignments_user_id_idx
  on public.daily_quote_assignments (user_id);

create index daily_quote_assignments_user_day_idx
  on public.daily_quote_assignments (user_id, day);

alter table public.daily_quote_assignments enable row level security;

create policy "Users can read own daily quote assignments"
on public.daily_quote_assignments
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own daily quote assignments"
on public.daily_quote_assignments
for insert
to authenticated
with check (user_id = auth.uid());

-- RLS only returns own rows, so expose taken quote indexes for a day
-- (no user_id) so assignment can avoid same-day collisions across people.
create or replace function public.daily_quote_indexes_used_on(p_day date)
returns setof integer
language sql
security definer
set search_path = public
stable
as $$
  select quote_index
  from public.daily_quote_assignments
  where day = p_day;
$$;

revoke all on function public.daily_quote_indexes_used_on(date) from public;
grant execute on function public.daily_quote_indexes_used_on(date) to authenticated;

-- Atomically claim a quote for the current user from a preferred candidate list.
create or replace function public.assign_daily_quote(
  p_day date,
  p_candidates integer[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing integer;
  v_idx integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select quote_index into v_existing
  from public.daily_quote_assignments
  where day = p_day and user_id = v_uid;

  if found then
    return v_existing;
  end if;

  if p_candidates is null or cardinality(p_candidates) = 0 then
    return null;
  end if;

  foreach v_idx in array p_candidates loop
    begin
      insert into public.daily_quote_assignments (day, user_id, quote_index)
      values (p_day, v_uid, v_idx);
      return v_idx;
    exception
      when unique_violation then
        select quote_index into v_existing
        from public.daily_quote_assignments
        where day = p_day and user_id = v_uid;
        if found then
          return v_existing;
        end if;
        -- quote_index already taken today; try next candidate
    end;
  end loop;

  return null;
end;
$$;

revoke all on function public.assign_daily_quote(date, integer[]) from public;
grant execute on function public.assign_daily_quote(date, integer[]) to authenticated;

comment on table public.daily_quote_assignments is
  'Per-user daily quote picks for My Week. unique(day, quote_index) prevents the same quote showing to two people on the same day.';
