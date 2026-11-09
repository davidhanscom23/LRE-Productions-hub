-- Feed comments + birthday / company anniversary celebration posts.

-- ---------------------------------------------------------------------------
-- Posts: celebration metadata
-- ---------------------------------------------------------------------------

alter table public.posts
  add column if not exists kind text not null default 'user';

alter table public.posts
  drop constraint if exists posts_kind_check;

alter table public.posts
  add constraint posts_kind_check
  check (kind in ('user', 'birthday', 'anniversary'));

alter table public.posts
  add column if not exists subject_profile_id uuid
    references public.profiles (id) on delete set null;

alter table public.posts
  add column if not exists celebration_date date;

comment on column public.posts.kind is
  'user = normal feed post; birthday/anniversary = auto Hub celebration.';
comment on column public.posts.subject_profile_id is
  'Person being celebrated (birthday/anniversary posts).';
comment on column public.posts.celebration_date is
  'America/New_York calendar date the celebration is for.';

create unique index if not exists posts_celebration_unique
  on public.posts (kind, subject_profile_id, celebration_date)
  where kind in ('birthday', 'anniversary')
    and subject_profile_id is not null
    and celebration_date is not null;

grant select (kind, subject_profile_id, celebration_date)
  on table public.posts to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint post_comments_body_not_blank check (char_length(trim(body)) > 0)
);

create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at asc);

alter table public.post_comments enable row level security;

drop policy if exists "Authenticated users can read post comments"
  on public.post_comments;
create policy "Authenticated users can read post comments"
  on public.post_comments
  for select
  to authenticated
  using (true);

drop policy if exists "Staff can insert own post comments"
  on public.post_comments;
create policy "Staff can insert own post comments"
  on public.post_comments
  for insert
  to authenticated
  with check (
    public.current_user_role() in ('admin', 'trainer', 'staff')
    and author_id = auth.uid()
  );

drop policy if exists "Authors and admins can delete post comments"
  on public.post_comments;
create policy "Authors and admins can delete post comments"
  on public.post_comments
  for delete
  to authenticated
  using (
    author_id = auth.uid()
    or public.is_admin()
  );

grant select, insert, delete on public.post_comments to authenticated;

-- ---------------------------------------------------------------------------
-- Ensure today's birthday / anniversary celebration posts exist
-- (idempotent; safe to call from Home on each load)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_today_celebration_posts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('America/New_York', now()))::date;
  v_month integer := extract(month from v_today)::integer;
  v_day integer := extract(day from v_today)::integer;
  r record;
  v_name text;
  v_years integer;
  v_years_label text;
  v_body text;
  v_inserted integer := 0;
begin
  for r in
    select p.id, p.full_name, p.email
    from public.profiles p
    where coalesce(p.is_active, true)
      and p.role is distinct from 'guest'
      and p.birthday is not null
      and extract(month from p.birthday::date) = v_month
      and extract(day from p.birthday::date) = v_day
  loop
    if exists (
      select 1 from public.posts po
      where po.kind = 'birthday'
        and po.subject_profile_id = r.id
        and po.celebration_date = v_today
    ) then
      continue;
    end if;

    v_name := coalesce(
      nullif(trim(r.full_name), ''),
      split_part(r.email, '@', 1),
      'teammate'
    );
    v_body :=
      'Happy Birthday, ' || v_name
      || '! Leave a note in the comments to celebrate.';

    insert into public.posts (
      author_id, body, kind, subject_profile_id, celebration_date
    )
    values (r.id, v_body, 'birthday', r.id, v_today);

    v_inserted := v_inserted + 1;
  end loop;

  for r in
    select p.id, p.full_name, p.email, p.start_date
    from public.profiles p
    where coalesce(p.is_active, true)
      and p.role is distinct from 'guest'
      and p.start_date is not null
      and extract(month from p.start_date::date) = v_month
      and extract(day from p.start_date::date) = v_day
  loop
    if exists (
      select 1 from public.posts po
      where po.kind = 'anniversary'
        and po.subject_profile_id = r.id
        and po.celebration_date = v_today
    ) then
      continue;
    end if;

    v_name := coalesce(
      nullif(trim(r.full_name), ''),
      split_part(r.email, '@', 1),
      'teammate'
    );
    v_years := greatest(
      0,
      extract(year from v_today)::integer
        - extract(year from r.start_date::date)::integer
    );
    if v_years <= 0 then
      v_years_label := 'hire day';
    elsif v_years = 1 then
      v_years_label := '1st year';
    elsif v_years = 2 then
      v_years_label := '2nd year';
    elsif v_years = 3 then
      v_years_label := '3rd year';
    else
      v_years_label := v_years::text || 'th year';
    end if;

    v_body :=
      'Happy company anniversary, ' || v_name
      || ' (' || v_years_label || ')! Leave a note in the comments to celebrate.';

    insert into public.posts (
      author_id, body, kind, subject_profile_id, celebration_date
    )
    values (r.id, v_body, 'anniversary', r.id, v_today);

    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

grant execute on function public.ensure_today_celebration_posts()
  to authenticated, service_role;
