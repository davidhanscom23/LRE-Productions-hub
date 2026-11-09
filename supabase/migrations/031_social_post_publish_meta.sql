-- Track Meta (and future) API publish results on marketing drafts.

alter table public.social_post_drafts
  add column if not exists external_post_id text,
  add column if not exists publish_error text;

comment on column public.social_post_drafts.external_post_id is
  'Platform post id returned by Meta Graph (or later LinkedIn/TikTok/X).';
comment on column public.social_post_drafts.publish_error is
  'Last API publish error message, cleared on success.';
