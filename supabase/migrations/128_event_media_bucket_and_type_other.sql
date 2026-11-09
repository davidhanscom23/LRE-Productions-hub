-- Event Packets: optional detail when event_type = Other,
-- and create the missing Supabase Storage bucket used for photos/videos.

alter table public.event_packets
  add column if not exists event_type_other text not null default '';

comment on column public.event_packets.event_type_other is
  'Free-text description when event_type is Other (e.g. Quinceañera, Fundraiser).';

-- ---------------------------------------------------------------------------
-- Storage bucket: event-media (packet photos/videos, expense receipts, etc.)
-- Paths are {auth.uid()}/… — never created in earlier migrations (only
-- `resources` was). Without this bucket, client uploads return "Bucket not found".
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-media',
  'event-media',
  false,
  209715200, -- 200 MB (photos + video)
  null
)
on conflict (id) do nothing;

drop policy if exists "Users can upload own event-media" on storage.objects;
create policy "Users can upload own event-media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read own event-media" on storage.objects;
create policy "Users can read own event-media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'event-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_user_role() in ('admin', 'trainer')
  )
);

drop policy if exists "Users can update own event-media" on storage.objects;
create policy "Users can update own event-media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'event-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
)
with check (
  bucket_id = 'event-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "Users can delete own event-media" on storage.objects;
create policy "Users can delete own event-media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);
