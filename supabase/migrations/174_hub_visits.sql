-- Remembers when each person was last on the Hub, so the Tools page can tag
-- tools that are new since their previous visit.
-- A "visit" is a stretch of activity; after 30 quiet minutes the next page view starts a new one.

create table if not exists public.hub_visits (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  last_visit_at     timestamptz not null default now(),
  previous_visit_at timestamptz
);

alter table public.hub_visits enable row level security;

drop policy if exists "hub_visits own select" on public.hub_visits;
create policy "hub_visits own select"
  on public.hub_visits for select to authenticated
  using (user_id = auth.uid());

grant select on public.hub_visits to authenticated;

-- Called on page views. Returns the time of the person's previous visit
-- (null for a first visit), and rolls the visit forward when a new one starts.
create or replace function public.touch_hub_visit()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  prev timestamptz;
  last timestamptz;
begin
  if uid is null then
    return null;
  end if;

  insert into public.hub_visits (user_id) values (uid)
  on conflict (user_id) do nothing;

  select previous_visit_at, last_visit_at into prev, last
  from public.hub_visits where user_id = uid for update;

  if last < now() - interval '30 minutes' then
    update public.hub_visits
      set previous_visit_at = last, last_visit_at = now()
      where user_id = uid;
    return last;
  elsif last < now() - interval '5 minutes' then
    update public.hub_visits set last_visit_at = now() where user_id = uid;
  end if;

  return prev;
end;
$$;

revoke all on function public.touch_hub_visit() from public;
grant execute on function public.touch_hub_visit() to authenticated;
