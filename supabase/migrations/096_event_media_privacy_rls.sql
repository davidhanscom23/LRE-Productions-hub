-- Tighten event_media SELECT (was using (true)).
-- Align with app ACL: uploader, packet assignee, trainer, admin.
-- Broaden UPDATE so assignees/trainers/admins can write Drive sync metadata.

drop policy if exists "Users can read event media" on public.event_media;
drop policy if exists "Users read own, assigned packet, or elevated event media"
  on public.event_media;

create policy "Users read own, assigned packet, or elevated event media"
  on public.event_media
  for select
  to authenticated
  using (
    uploader_id = auth.uid()
    or public.is_admin()
    or public.current_user_role()::text = 'trainer'
    or (
      packet_id is not null
      and exists (
        select 1
        from public.event_packets p
        where p.id = event_media.packet_id
          and p.assignee_id = auth.uid()
      )
    )
  );

drop policy if exists "Authors and admins can update event media"
  on public.event_media;
drop policy if exists "Authors assignees trainers admins update event media"
  on public.event_media;

create policy "Authors assignees trainers admins update event media"
  on public.event_media
  for update
  to authenticated
  using (
    uploader_id = auth.uid()
    or public.is_admin()
    or public.current_user_role()::text = 'trainer'
    or (
      packet_id is not null
      and exists (
        select 1
        from public.event_packets p
        where p.id = event_media.packet_id
          and p.assignee_id = auth.uid()
      )
    )
  )
  with check (
    uploader_id = auth.uid()
    or public.is_admin()
    or public.current_user_role()::text = 'trainer'
    or (
      packet_id is not null
      and exists (
        select 1
        from public.event_packets p
        where p.id = event_media.packet_id
          and p.assignee_id = auth.uid()
      )
    )
  );
