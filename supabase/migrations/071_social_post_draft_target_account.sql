-- Optional Post for Me connection id per Marketing Queue draft (multi-brand).
alter table public.social_post_drafts
  add column if not exists target_social_account_id text;

comment on column public.social_post_drafts.target_social_account_id is
  'Optional Post for Me connection id (spc_...) — publishes this draft to a specific connected brand/page. Null = platform default.';
