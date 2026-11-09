-- Client Reviews hub module: discovery + sliding-scale review count milestones.

insert into public.hub_achievements
  (key, title, description, points, difficulty, category, repeatable,
   discover_path, unique_meta_field, daily_count_cap, sort_order)
values
  ('discover_client_reviews', 'Client Reviews',
   'Open Client Reviews', 25, 'medium', 'discover', false,
   '/client-reviews', null, null, 315),

  ('client_reviews_1', 'First client review',
   'Earn your first website client review', 40, 'easy', 'field', false,
   null, null, null, 1000),
  ('client_reviews_3', 'Client reviews · 3',
   'Collect 3 website client reviews', 60, 'easy', 'field', false,
   null, null, null, 1010),
  ('client_reviews_5', 'Client reviews · 5',
   'Collect 5 website client reviews', 100, 'medium', 'field', false,
   null, null, null, 1020),
  ('client_reviews_10', 'Client reviews · 10',
   'Collect 10 website client reviews', 200, 'medium', 'field', false,
   null, null, null, 1030),
  ('client_reviews_25', 'Client reviews · 25',
   'Collect 25 website client reviews', 400, 'hard', 'field', false,
   null, null, null, 1040),
  ('client_reviews_50', 'Client reviews · 50',
   'Collect 50 website client reviews', 750, 'legendary', 'field', false,
   null, null, null, 1050),
  ('client_reviews_100', 'Client reviews · 100',
   'Collect 100 website client reviews', 1500, 'legendary', 'field', false,
   null, null, null, 1060)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  points = excluded.points,
  difficulty = excluded.difficulty,
  category = excluded.category,
  repeatable = excluded.repeatable,
  discover_path = excluded.discover_path,
  unique_meta_field = excluded.unique_meta_field,
  daily_count_cap = excluded.daily_count_cap,
  sort_order = excluded.sort_order,
  is_active = true;
