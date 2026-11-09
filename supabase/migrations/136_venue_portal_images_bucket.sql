-- Public bucket for venue quote portal images (hero, logo, spaces, add-ons).
-- Public read (the quote pages are public); only admins can write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-portal-images',
  'venue-portal-images',
  true,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

drop policy if exists "venue-portal-images admin insert" on storage.objects;
create policy "venue-portal-images admin insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'venue-portal-images' and public.is_admin());

drop policy if exists "venue-portal-images admin update" on storage.objects;
create policy "venue-portal-images admin update"
on storage.objects for update to authenticated
using (bucket_id = 'venue-portal-images' and public.is_admin());

drop policy if exists "venue-portal-images admin delete" on storage.objects;
create policy "venue-portal-images admin delete"
on storage.objects for delete to authenticated
using (bucket_id = 'venue-portal-images' and public.is_admin());
