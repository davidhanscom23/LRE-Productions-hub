-- 052 Performance Reviews
-- Review cycles (admin-created). Each staffer gets one review per cycle:
-- a self-assessment (they fill) + a manager review (admin fills) with
-- competency ratings, overall notes/rating, and goals. Manager feedback is
-- hidden from the staffer until an admin shares it.

create table if not exists public.review_cycles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  due_date    date,
  status      text not null default 'open' check (status in ('open','closed')),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table if not exists public.performance_reviews (
  id                uuid primary key default gen_random_uuid(),
  cycle_id          uuid not null references public.review_cycles(id) on delete cascade,
  subject_id        uuid not null references public.profiles(id) on delete cascade,
  -- Self-assessment (owned by the staffer)
  self_ratings      jsonb not null default '{}'::jsonb,   -- { key: { score, comment } }
  self_overall      text not null default '',
  self_status       text not null default 'not_started' check (self_status in ('not_started','submitted')),
  self_submitted_at timestamptz,
  -- Manager review (owned by admins)
  manager_ratings   jsonb not null default '{}'::jsonb,
  manager_overall   text not null default '',
  overall_rating    int check (overall_rating between 1 and 5),
  goals             jsonb not null default '[]'::jsonb,   -- [ { title, detail, status } ]
  manager_status    text not null default 'not_started' check (manager_status in ('not_started','in_progress','shared')),
  reviewed_by       uuid references public.profiles(id),
  reviewed_at       timestamptz,
  shared_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (cycle_id, subject_id)
);

create index if not exists performance_reviews_cycle_idx on public.performance_reviews (cycle_id);
create index if not exists performance_reviews_subject_idx on public.performance_reviews (subject_id);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.review_cycles enable row level security;
alter table public.performance_reviews enable row level security;

-- Cycles: everyone signed-in can read cycle names; only admins manage.
drop policy if exists "cycles read (authenticated)" on public.review_cycles;
create policy "cycles read (authenticated)"
  on public.review_cycles for select to authenticated using (true);

drop policy if exists "cycles admin write" on public.review_cycles;
create policy "cycles admin write"
  on public.review_cycles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Reviews: direct table access is admin-only. Staff never read/write the
-- table directly — they go through the SECURITY DEFINER functions below,
-- which blank out manager feedback until it is shared.
drop policy if exists "reviews admin all" on public.performance_reviews;
create policy "reviews admin all"
  on public.performance_reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.review_cycles to authenticated;
grant select, insert, update, delete on public.performance_reviews to authenticated;

-- ── Staff-side reads (manager feedback hidden until shared) ──────────
create or replace function public.list_my_reviews()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'cycle_id', r.cycle_id,
    'cycle_name', c.name,
    'cycle_status', c.status,
    'due_date', c.due_date,
    'self_ratings', r.self_ratings,
    'self_overall', r.self_overall,
    'self_status', r.self_status,
    'self_submitted_at', r.self_submitted_at,
    'manager_status', r.manager_status,
    'shared', (r.manager_status = 'shared'),
    'manager_ratings', case when r.manager_status = 'shared' then r.manager_ratings else '{}'::jsonb end,
    'manager_overall', case when r.manager_status = 'shared' then r.manager_overall else '' end,
    'overall_rating', case when r.manager_status = 'shared' then r.overall_rating else null end,
    'goals', case when r.manager_status = 'shared' then r.goals else '[]'::jsonb end,
    'reviewed_at', case when r.manager_status = 'shared' then r.reviewed_at else null end
  )
  from public.performance_reviews r
  join public.review_cycles c on c.id = r.cycle_id
  where r.subject_id = auth.uid()
  order by c.created_at desc;
$$;

grant execute on function public.list_my_reviews() to authenticated;

-- ── Staff-side self-assessment write ─────────────────────────────────
create or replace function public.save_self_assessment(
  p_review_id uuid,
  p_ratings jsonb,
  p_overall text,
  p_submit boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.performance_reviews%rowtype;
  c public.review_cycles%rowtype;
begin
  select * into r from public.performance_reviews where id = p_review_id;
  if not found then raise exception 'Review not found'; end if;
  if r.subject_id <> auth.uid() then raise exception 'Not your review'; end if;
  if r.self_status = 'submitted' then raise exception 'Self-assessment already submitted'; end if;

  select * into c from public.review_cycles where id = r.cycle_id;
  if c.status <> 'open' then raise exception 'This review cycle is closed'; end if;

  update public.performance_reviews
     set self_ratings = coalesce(p_ratings, '{}'::jsonb),
         self_overall = coalesce(p_overall, ''),
         self_status = case when p_submit then 'submitted' else 'not_started' end,
         self_submitted_at = case when p_submit then now() else self_submitted_at end,
         updated_at = now()
   where id = p_review_id;
end;
$$;

grant execute on function public.save_self_assessment(uuid, jsonb, text, boolean) to authenticated;
