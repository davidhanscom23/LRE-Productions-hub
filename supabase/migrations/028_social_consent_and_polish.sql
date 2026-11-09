-- Social posting consent on packets + allow trainers to save captions +
-- let authenticated users maintain Drive folder cache during backup sync.

alter table public.event_packets
  add column if not exists social_consent boolean not null default false,
  add column if not exists social_consent_notes text not null default '';

comment on column public.event_packets.social_consent is
  'True when the client/staff confirmed photos may be used for social media.';

-- Trainers can also write captions for packets they can see.
drop policy if exists "Users upsert social captions for own or admin packets"
  on public.social_captions;
drop policy if exists "Users update social captions for own or admin packets"
  on public.social_captions;

create policy "Users upsert social captions for accessible packets"
on public.social_captions for insert to authenticated
with check (
  exists (
    select 1 from public.event_packets p
    where p.id = packet_id
      and (
        p.assignee_id = auth.uid()
        or public.current_user_role() in ('admin', 'trainer')
      )
  )
);

create policy "Users update social captions for accessible packets"
on public.social_captions for update to authenticated
using (
  exists (
    select 1 from public.event_packets p
    where p.id = packet_id
      and (
        p.assignee_id = auth.uid()
        or public.current_user_role() in ('admin', 'trainer')
      )
  )
)
with check (
  exists (
    select 1 from public.event_packets p
    where p.id = packet_id
      and (
        p.assignee_id = auth.uid()
        or public.current_user_role() in ('admin', 'trainer')
      )
  )
);

-- Folder cache is path→Drive id mapping used during backup; safe for staff sync.
drop policy if exists "Admins manage drive folder cache"
  on public.drive_folder_cache;

create policy "Authenticated read drive folder cache"
on public.drive_folder_cache for select to authenticated
using (true);

create policy "Authenticated upsert drive folder cache"
on public.drive_folder_cache for insert to authenticated
with check (true);

create policy "Authenticated update drive folder cache"
on public.drive_folder_cache for update to authenticated
using (true)
with check (true);

create policy "Admins delete drive folder cache"
on public.drive_folder_cache for delete to authenticated
using (public.is_admin());
