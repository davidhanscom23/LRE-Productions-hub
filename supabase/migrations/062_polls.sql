-- 062 Team polls. Admin/trainer create; everyone votes; results via RPC.

create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  is_closed  boolean not null default false,
  closes_at  date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint polls_question_not_blank check (char_length(trim(question)) > 0)
);

create table if not exists public.poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls(id) on delete cascade,
  label      text not null,
  sort_order int not null default 0
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id);

create table if not exists public.poll_votes (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls(id) on delete cascade,
  option_id  uuid not null references public.poll_options(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);
create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);
create index if not exists poll_votes_option_idx on public.poll_votes (option_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- Polls & options: everyone reads; admins/trainers manage.
drop policy if exists "polls read" on public.polls;
create policy "polls read" on public.polls for select to authenticated using (true);
drop policy if exists "polls write" on public.polls;
create policy "polls write" on public.polls for all to authenticated
  using (public.current_user_role() in ('admin','trainer'))
  with check (public.current_user_role() in ('admin','trainer'));

drop policy if exists "poll_options read" on public.poll_options;
create policy "poll_options read" on public.poll_options for select to authenticated using (true);
drop policy if exists "poll_options write" on public.poll_options;
create policy "poll_options write" on public.poll_options for all to authenticated
  using (public.current_user_role() in ('admin','trainer'))
  with check (public.current_user_role() in ('admin','trainer'));

-- Votes: a user manages their own; individual votes are private (results come
-- from the SECURITY DEFINER function below, which returns only counts).
drop policy if exists "poll_votes own" on public.poll_votes;
create policy "poll_votes own" on public.poll_votes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.polls to authenticated;
grant select, insert, update, delete on public.poll_options to authenticated;
grant select, insert, update, delete on public.poll_votes to authenticated;

create or replace function public.list_polls_with_results()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'question', p.question,
    'is_closed', p.is_closed,
    'closes_at', p.closes_at,
    'created_at', p.created_at,
    'created_by', p.created_by,
    'my_option_id', (select v.option_id from public.poll_votes v where v.poll_id = p.id and v.user_id = auth.uid()),
    'total_votes', (select count(*) from public.poll_votes v where v.poll_id = p.id),
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id,
        'label', o.label,
        'sort_order', o.sort_order,
        'votes', (select count(*) from public.poll_votes v where v.option_id = o.id)
      ) order by o.sort_order), '[]'::jsonb)
      from public.poll_options o where o.poll_id = p.id
    )
  )
  from public.polls p
  order by p.is_closed asc, p.created_at desc;
$$;

grant execute on function public.list_polls_with_results() to authenticated;
