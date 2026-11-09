-- How-to video points: 5 per video (once per lesson) + 100-point finish bonus.
insert into public.hub_achievements
  (key, title, description, points, difficulty, category, repeatable,
   unique_meta_field, daily_count_cap, sort_order)
values
  ('howto_video_watched', 'How-to video watched',
   'Watch at least 90% of a Training Portal how-to video', 5, 'easy', 'learn', true,
   'lesson_id', null, 905),
  ('howto_all_watched', 'All how-to videos watched',
   'Finish every how-to video you have access to', 100, 'hard', 'learn', false,
   null, null, 906)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  points = excluded.points,
  difficulty = excluded.difficulty,
  category = excluded.category,
  repeatable = excluded.repeatable,
  unique_meta_field = excluded.unique_meta_field,
  daily_count_cap = excluded.daily_count_cap,
  sort_order = excluded.sort_order,
  is_active = true;
