-- Client reviews: store credited Hub profile IDs so RLS can enforce
-- "staff see only their attributed reviews" (attribution was app-layer only).

alter table public.event_external_reviews
  add column if not exists credited_profile_ids uuid[] not null default '{}';

comment on column public.event_external_reviews.credited_profile_ids is
  'Hub profile IDs credited for this review (sheet staff names + packet assignees). Populated by review sync.';

create index if not exists event_external_reviews_credited_profile_ids_gin
  on public.event_external_reviews using gin (credited_profile_ids);

drop policy if exists "Authenticated users can read event external reviews"
  on public.event_external_reviews;
drop policy if exists "Users read credited or elevated event external reviews"
  on public.event_external_reviews;

create policy "Users read credited or elevated event external reviews"
  on public.event_external_reviews
  for select
  to authenticated
  using (
    public.current_user_role() is distinct from 'guest'
    and (
      public.is_admin()
      or public.current_user_role()::text = 'trainer'
      or auth.uid() = any (credited_profile_ids)
      or (
        calendar_uid is not null
        and exists (
          select 1
          from public.event_packets p
          where p.assignee_id = auth.uid()
            and p.calendar_uid = event_external_reviews.calendar_uid
        )
      )
    )
  );
