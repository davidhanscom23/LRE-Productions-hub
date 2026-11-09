-- Instagram Collabs usernames on marketing drafts (invite at publish time).

alter table public.social_post_drafts
  add column if not exists ig_collaborators text[] not null default '{}';

comment on column public.social_post_drafts.ig_collaborators is
  'Instagram usernames invited as Collabs when publishing (max 3). They must accept in Instagram before the post appears on their profile.';
