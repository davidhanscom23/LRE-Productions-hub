-- Company Feed: announcement posts on the Home dashboard

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint posts_body_not_blank check (char_length(trim(body)) > 0)
);

create index posts_created_at_idx on public.posts (created_at desc);
create index posts_author_id_idx on public.posts (author_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.posts enable row level security;

-- Any signed-in user can read posts
create policy "Authenticated users can read posts"
on public.posts
for select
to authenticated
using (true);

-- Admins and trainers can create posts (must be the author)
create policy "Admins and trainers can insert posts"
on public.posts
for insert
to authenticated
with check (
  public.current_user_role() in ('admin', 'trainer')
  and author_id = auth.uid()
);

-- Author or admin can delete
create policy "Authors and admins can delete posts"
on public.posts
for delete
to authenticated
using (
  author_id = auth.uid()
  or public.is_admin()
);
