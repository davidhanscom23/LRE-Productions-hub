-- Allow multiple media attachments per marketing draft (ordered).
-- media_id remains as the primary/first selection for backward compatibility.

alter table public.social_post_drafts
  add column if not exists media_ids uuid[] not null default '{}';

-- Backfill from legacy single media_id.
update public.social_post_drafts
set media_ids = array[media_id]
where media_id is not null
  and (media_ids is null or cardinality(media_ids) = 0);

comment on column public.social_post_drafts.media_ids is
  'Ordered event_media ids attached to this draft (carousel / multi-photo). First entry mirrors media_id.';
