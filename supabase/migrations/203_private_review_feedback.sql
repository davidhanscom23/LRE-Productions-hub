-- Private feedback left by clients who rated 1-3 stars on the public review
-- page (review.lreproductions.com). Written by /api/review-feedback with the
-- service role; readable and updatable by admins only.

create table if not exists public.private_review_feedback (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  email text not null,
  improve_areas text not null default '',
  team_handled text not null default '',
  rating smallint null,
  status text not null default 'new',
  reviewed_at timestamptz null,
  reviewed_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint private_review_feedback_rating_range
    check (rating is null or (rating between 1 and 5)),
  constraint private_review_feedback_status_valid
    check (status in ('new', 'reviewed'))
);

create index if not exists private_review_feedback_created_idx
  on public.private_review_feedback (created_at desc);

comment on table public.private_review_feedback is
  'Private feedback left by clients who rated 1-3 stars on the public review page. Admins only.';

alter table public.private_review_feedback enable row level security;

drop policy if exists "private_review_feedback admin read"
  on public.private_review_feedback;
create policy "private_review_feedback admin read"
  on public.private_review_feedback
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "private_review_feedback admin update"
  on public.private_review_feedback;
create policy "private_review_feedback admin update"
  on public.private_review_feedback
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

grant select, update on public.private_review_feedback to authenticated;
