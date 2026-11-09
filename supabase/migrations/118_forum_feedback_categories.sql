-- Add hub feedback categories to the forum: Hub Bugs and Hub Wishlist.
-- (Already applied to production via the SQL editor on 2026-08-15.)

insert into public.forum_categories (name, slug, sort_order) values
  ('Hub Bugs', 'hub-bugs', 80),
  ('Hub Wishlist', 'hub-wishlist', 90)
on conflict (slug) do nothing;
