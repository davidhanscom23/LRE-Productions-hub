-- Track where each event_media object lives (Supabase bucket vs Bunny CDN).

alter table public.event_media
  add column if not exists storage_provider text not null default 'supabase';

alter table public.event_media
  drop constraint if exists event_media_storage_provider_check;

alter table public.event_media
  add constraint event_media_storage_provider_check
  check (storage_provider in ('supabase', 'bunny'));

comment on column public.event_media.storage_provider is
  'Object store for storage_path: supabase (signed URLs) or bunny (CDN URL).';
