-- Staff, leads (trainer), and admins can add resources.
-- Edit stays admin/trainer. Delete stays admin. Guests stay read-only.

drop policy if exists "Admins and trainers can insert resources" on public.resources;
drop policy if exists "Staff can insert resources" on public.resources;

create policy "Staff can insert resources"
on public.resources
for insert
to authenticated
with check (
  public.current_user_role() in ('admin', 'trainer', 'staff')
  and created_by = auth.uid()
);

drop policy if exists "Trainers and admins can upload resources" on storage.objects;
drop policy if exists "Staff can upload resources" on storage.objects;

create policy "Staff can upload resources"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'resources'
  and public.current_user_role() in ('admin', 'trainer', 'staff')
);
