-- Pinterest board registry (admin-managed) + per-draft board target.
-- Post for Me has no boards list API, so Hub stores label + board_id pairs.

create table if not exists public.pinterest_boards (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  board_id text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint pinterest_boards_label_not_blank check (char_length(trim(label)) > 0),
  constraint pinterest_boards_board_id_not_blank check (char_length(trim(board_id)) > 0),
  constraint pinterest_boards_board_id_unique unique (board_id)
);

create index if not exists pinterest_boards_sort_idx
  on public.pinterest_boards (sort_order, label);

comment on table public.pinterest_boards is
  'Admin-managed Pinterest boards for Marketing Queue pin targeting (Post for Me board_ids).';

alter table public.pinterest_boards enable row level security;

drop policy if exists "Authenticated can read pinterest_boards" on public.pinterest_boards;
create policy "Authenticated can read pinterest_boards"
  on public.pinterest_boards for select to authenticated
  using (true);

drop policy if exists "Admins manage pinterest_boards insert" on public.pinterest_boards;
create policy "Admins manage pinterest_boards insert"
  on public.pinterest_boards for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins manage pinterest_boards update" on public.pinterest_boards;
create policy "Admins manage pinterest_boards update"
  on public.pinterest_boards for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage pinterest_boards delete" on public.pinterest_boards;
create policy "Admins manage pinterest_boards delete"
  on public.pinterest_boards for delete to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.pinterest_boards to authenticated;

alter table public.social_post_drafts
  add column if not exists target_pinterest_board_id text;

comment on column public.social_post_drafts.target_pinterest_board_id is
  'Optional Pinterest board id for Post for Me platform_configurations.pinterest.board_ids. Null = account default board only.';
