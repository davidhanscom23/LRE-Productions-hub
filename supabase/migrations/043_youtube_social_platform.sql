-- Add YouTube as a Social Studio / Marketing Queue platform.
-- Captions + drafts use the same admin-approval flow as other platforms.

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
      'youtube'
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
      'youtube'
    )
  );
