-- 100 Auto-complete out-of-department training for staff.
-- If an active staffer is NOT in a course's department, mark that department's
-- published course complete for them (they aren't expected to take it).
-- "All staff" courses (e.g. onboarding) are never auto-completed.
-- Idempotent: only inserts missing completions.

insert into public.training_lesson_completions (user_id, lesson_id)
select p.id, l.id
from public.profiles p
join public.training_courses c
  on c.status = 'published'
  and c.audience in ('Audiovisual', 'Corporate', 'Wedding & Social', 'Golf', 'Office')
  and not (c.audience = any (coalesce(p.departments, '{}'::text[])))
join public.training_lessons l on l.course_id = c.id
where p.is_active = true
  and p.role <> 'guest'
  and not exists (
    select 1 from public.training_lesson_completions tc
    where tc.user_id = p.id and tc.lesson_id = l.id
  )
on conflict (user_id, lesson_id) do nothing;
