-- Personal tasks for My Week

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  due_date date null,
  created_at timestamptz not null default now(),
  constraint tasks_title_not_blank check (char_length(trim(title)) > 0)
);

create index tasks_user_id_created_at_idx
  on public.tasks (user_id, created_at desc);

create index tasks_user_id_is_done_idx
  on public.tasks (user_id, is_done);

alter table public.tasks enable row level security;

create policy "Users can select own tasks"
on public.tasks
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own tasks"
on public.tasks
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own tasks"
on public.tasks
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own tasks"
on public.tasks
for delete
to authenticated
using (user_id = auth.uid());

comment on table public.tasks is
  'Personal to-do items for My Week; each user only sees their own rows.';
