-- Add Threads + Pinterest as Social Studio / Marketing Queue platforms.
-- Both publish via Post for Me (same path as LinkedIn / TikTok).

alter table public.social_captions
  drop constraint if exists social_captions_platform_check;

alter table public.social_captions
  add constraint social_captions_platform_check
  check (
    platform in (
      'facebook',
      'instagram',
      'linkedin',
      'tiktok',
      'twitter',
      'youtube',
      'threads',
      'pinterest'
    )
  );

alter table public.social_post_drafts
  drop constraint if exists social_post_drafts_platform_check;

alter table public.social_post_drafts
  add constraint social_post_drafts_platform_check
  check (
    platform in (
      'facebook',
      'instagram',
      'linkedin',
      'tiktok',
      'twitter',
      'youtube',
      'threads',
      'pinterest'
    )
  );
