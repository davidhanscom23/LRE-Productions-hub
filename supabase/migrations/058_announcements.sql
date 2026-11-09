-- 058 Announcements. Admin/trainer post; everyone reads; optional acknowledgement.

create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null default '',
  requires_ack boolean not null default false,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  expires_at   date,
  constraint announcements_title_not_blank check (char_length(trim(title)) > 0)
);

create index if not exists announcements_created_idx on public.announcements (created_at desc);

create table if not exists public.announcement_acks (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index if not exists announcement_acks_ann_idx on public.announcement_acks (announcement_id);

alter table public.announcements enable row level security;
alter table public.announcement_acks enable row level security;

-- Everyone signed in reads announcements; admins/trainers post & manage.
drop policy if exists "announcements read (authenticated)" on public.announcements;
create policy "announcements read (authenticated)"
  on public.announcements for select to authenticated using (true);

drop policy if exists "announcements write (admin/trainer)" on public.announcements;
create policy "announcements write (admin/trainer)"
  on public.announcements for all to authenticated
  using (public.current_user_role() in ('admin','trainer'))
  with check (public.current_user_role() in ('admin','trainer'));

-- Acks: a user records/reads their own; admins can read all.
drop policy if exists "acks read own or admin" on public.announcement_acks;
create policy "acks read own or admin"
  on public.announcement_acks for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "acks insert own" on public.announcement_acks;
create policy "acks insert own"
  on public.announcement_acks for insert to authenticated
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.announcements to authenticated;
grant select, insert, update, delete on public.announcement_acks to authenticated;
