-- Allow packet assignees and trainers to delete event_media (in addition to
-- uploader + admin). Needed so Event Packet media can be removed when reviewing.

drop policy if exists "Authors and admins can delete event media"
  on public.event_media;
drop policy if exists "Authors admins trainers assignees can delete event media"
  on public.event_media;

create policy "Authors admins trainers assignees can delete event media"
on public.event_media
for delete
to authenticated
using (
  uploader_id = auth.uid()
  or public.is_admin()
  or public.current_user_role()::text = 'trainer'
  or exists (
    select 1
    from public.event_packets p
    where p.id = event_media.packet_id
      and p.assignee_id = auth.uid()
  )
);
