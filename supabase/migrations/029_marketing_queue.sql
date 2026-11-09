-- Marketing queue drafts for Social Studio (copy/schedule foundation).

create table public.social_post_drafts (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.event_packets (id) on delete cascade,
  media_id uuid references public.event_media (id) on delete set null,
  platform text not null
    check (platform in ('facebook', 'instagram', 'linkedin', 'tiktok', 'twitter')),
  caption text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'posted', 'skipped')),
  scheduled_for timestamptz,
  posted_at timestamptz,
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index social_post_drafts_packet_id_idx on public.social_post_drafts (packet_id);
create index social_post_drafts_status_idx on public.social_post_drafts (status);
create index social_post_drafts_scheduled_for_idx on public.social_post_drafts (scheduled_for);

alter table public.social_post_drafts enable row level security;

create policy "Admin/trainer read social post drafts"
on public.social_post_drafts for select to authenticated
using (public.current_user_role() in ('admin', 'trainer'));

create policy "Admin/trainer insert social post drafts"
on public.social_post_drafts for insert to authenticated
with check (public.current_user_role() in ('admin', 'trainer'));

create policy "Admin/trainer update social post drafts"
on public.social_post_drafts for update to authenticated
using (public.current_user_role() in ('admin', 'trainer'))
with check (public.current_user_role() in ('admin', 'trainer'));

create policy "Admins delete social post drafts"
on public.social_post_drafts for delete to authenticated
using (public.is_admin());

comment on table public.social_post_drafts is
  'Marketing queue drafts for platform posts. Auto-publish APIs can land later; status workflow works today.';
