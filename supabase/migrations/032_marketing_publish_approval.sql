-- Publish approval workflow + in-app notifications for admins.

-- Expand draft statuses for approval gate
alter table public.social_post_drafts
  drop constraint if exists social_post_drafts_status_check;

alter table public.social_post_drafts
  add constraint social_post_drafts_status_check
  check (
    status in (
      'draft',
      'ready',
      'pending_approval',
      'posted',
      'skipped',
      'rejected'
    )
  );

alter table public.social_post_drafts
  add column if not exists requested_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text not null default '';

create index if not exists social_post_drafts_pending_approval_idx
  on public.social_post_drafts (status)
  where status = 'pending_approval';

-- In-app notifications (used for publish approval requests)
create table if not exists public.hub_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'info',
  title text not null default '',
  body text not null default '',
  href text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hub_notifications_user_id_created_idx
  on public.hub_notifications (user_id, created_at desc);

create index if not exists hub_notifications_user_unread_idx
  on public.hub_notifications (user_id)
  where read_at is null;

alter table public.hub_notifications enable row level security;

drop policy if exists "Users read own notifications" on public.hub_notifications;
create policy "Users read own notifications"
on public.hub_notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users update own notifications" on public.hub_notifications;
create policy "Users update own notifications"
on public.hub_notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Marketers/admins can create notifications for admins (approval requests)
-- and for the requester (approve/deny outcome).
drop policy if exists "Marketers insert notifications" on public.hub_notifications;
create policy "Marketers insert notifications"
on public.hub_notifications for insert to authenticated
with check (
  public.current_user_role() in ('admin', 'trainer')
);

comment on table public.hub_notifications is
  'In-app notifications (e.g. marketing publish approval requests).';
