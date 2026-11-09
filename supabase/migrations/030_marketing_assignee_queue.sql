-- Allow packet assignees to create marketing drafts for their own completed packets
-- (so complete + consent can auto-queue without waiting for an admin).

drop policy if exists "Admin/trainer insert social post drafts"
  on public.social_post_drafts;

create policy "Assignee or marketer insert social post drafts"
on public.social_post_drafts for insert to authenticated
with check (
  public.current_user_role() in ('admin', 'trainer')
  or exists (
    select 1 from public.event_packets p
    where p.id = packet_id
      and p.assignee_id = auth.uid()
  )
);
