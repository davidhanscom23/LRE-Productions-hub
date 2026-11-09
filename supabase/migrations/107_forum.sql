-- 101 Community Forum. Categorized discussion board: categories, threads
-- (discussions), posts (replies), follows, and link attachments.

create table if not exists public.forum_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint forum_categories_name_not_blank check (char_length(trim(name)) > 0)
);

create table if not exists public.forum_threads (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid references public.forum_categories(id) on delete set null,
  author_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title            text not null,
  body             text not null default '',
  is_pinned        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  constraint forum_threads_title_not_blank check (char_length(trim(title)) > 0)
);
create index if not exists forum_threads_category_idx on public.forum_threads (category_id);
create index if not exists forum_threads_activity_idx on public.forum_threads (last_activity_at desc);

create table if not exists public.forum_posts (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.forum_threads(id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null default '',
  created_at timestamptz not null default now(),
  constraint forum_posts_body_not_blank check (char_length(trim(body)) > 0)
);
create index if not exists forum_posts_thread_idx on public.forum_posts (thread_id, created_at);

create table if not exists public.forum_follows (
  thread_id  uuid not null references public.forum_threads(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.forum_attachments (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.forum_threads(id) on delete cascade,
  title      text not null default '',
  url        text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint forum_attachments_url_not_blank check (char_length(trim(url)) > 0)
);
create index if not exists forum_attachments_thread_idx on public.forum_attachments (thread_id);

alter table public.forum_categories  enable row level security;
alter table public.forum_threads     enable row level security;
alter table public.forum_posts       enable row level security;
alter table public.forum_follows     enable row level security;
alter table public.forum_attachments enable row level security;

-- Categories: everyone reads; admins manage.
drop policy if exists "forum_categories read" on public.forum_categories;
create policy "forum_categories read" on public.forum_categories
  for select to authenticated using (true);
drop policy if exists "forum_categories write" on public.forum_categories;
create policy "forum_categories write" on public.forum_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Threads: non-guests read + create; author or admin edits/deletes.
drop policy if exists "forum_threads read" on public.forum_threads;
create policy "forum_threads read" on public.forum_threads
  for select to authenticated using (public.current_user_role() <> 'guest');
drop policy if exists "forum_threads insert" on public.forum_threads;
create policy "forum_threads insert" on public.forum_threads
  for insert to authenticated
  with check (author_id = auth.uid() and public.current_user_role() <> 'guest');
drop policy if exists "forum_threads update" on public.forum_threads;
create policy "forum_threads update" on public.forum_threads
  for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
drop policy if exists "forum_threads delete" on public.forum_threads;
create policy "forum_threads delete" on public.forum_threads
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

-- Posts: non-guests read + create; author or admin deletes.
drop policy if exists "forum_posts read" on public.forum_posts;
create policy "forum_posts read" on public.forum_posts
  for select to authenticated using (public.current_user_role() <> 'guest');
drop policy if exists "forum_posts insert" on public.forum_posts;
create policy "forum_posts insert" on public.forum_posts
  for insert to authenticated
  with check (author_id = auth.uid() and public.current_user_role() <> 'guest');
drop policy if exists "forum_posts delete" on public.forum_posts;
create policy "forum_posts delete" on public.forum_posts
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

-- Follows: a user manages their own.
drop policy if exists "forum_follows own" on public.forum_follows;
create policy "forum_follows own" on public.forum_follows
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Attachments: non-guests read; thread author or admin manage.
drop policy if exists "forum_attachments read" on public.forum_attachments;
create policy "forum_attachments read" on public.forum_attachments
  for select to authenticated using (public.current_user_role() <> 'guest');
drop policy if exists "forum_attachments write" on public.forum_attachments;
create policy "forum_attachments write" on public.forum_attachments
  for all to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.forum_threads t
      where t.id = thread_id and t.author_id = auth.uid()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.forum_threads t
      where t.id = thread_id and t.author_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.forum_categories  to authenticated;
grant select, insert, update, delete on public.forum_threads     to authenticated;
grant select, insert, update, delete on public.forum_posts       to authenticated;
grant select, insert, update, delete on public.forum_follows     to authenticated;
grant select, insert, update, delete on public.forum_attachments to authenticated;

-- Bump thread activity when a reply is posted.
create or replace function public.forum_touch_thread()
returns trigger language plpgsql as $$
begin
  update public.forum_threads
  set last_activity_at = now(), updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;
drop trigger if exists forum_posts_touch on public.forum_posts;
create trigger forum_posts_touch after insert on public.forum_posts
  for each row execute function public.forum_touch_thread();

-- Notify the thread author + followers when someone replies (SECURITY DEFINER
-- so any staffer's reply can notify others). Skips the replier.
create or replace function public.notify_forum_reply(p_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  po public.forum_posts%rowtype;
  th public.forum_threads%rowtype;
  replier text;
begin
  select * into po from public.forum_posts where id = p_post_id;
  if not found then return; end if;
  if po.author_id <> auth.uid() then raise exception 'Not your post'; end if;
  select * into th from public.forum_threads where id = po.thread_id;
  if not found then return; end if;

  select full_name into replier from public.profiles where id = po.author_id;

  insert into public.hub_notifications (user_id, kind, title, body, href)
  select uid, 'announcement',
         'New reply in the forum',
         coalesce(nullif(replier,''),'Someone') || ' replied to "' || left(th.title, 80) || '"',
         '/forum/' || th.id
  from (
    select th.author_id as uid
    union
    select f.user_id from public.forum_follows f where f.thread_id = th.id
  ) targets
  where uid is not null and uid <> po.author_id
    and exists (select 1 from public.profiles p where p.id = uid and p.is_active and p.role <> 'guest');
end;
$$;
grant execute on function public.notify_forum_reply(uuid) to authenticated;

-- Seed default categories.
insert into public.forum_categories (name, slug, sort_order) values
  ('Ask the Team',          'ask-the-team',          10),
  ('Gear & Production',     'gear-production',       20),
  ('Sales & Marketing',     'sales-marketing',       30),
  ('Staffing & Training',   'staffing-training',     40),
  ('Business & Operations', 'business-operations',   50),
  ('Wins & Shoutouts',      'wins-shoutouts',        60),
  ('Off Topic',             'off-topic',             70)
on conflict (slug) do nothing;
