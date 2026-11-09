-- Rebrand leftover onboarding training copy that still said Y? Entertainment.
-- Migration 109 already removed DJ / Photobooth / DJEP courses; this cleans the
-- generic onboarding lesson that remains.

update public.training_lessons
set
  title = 'Welcome to Vident Productions',
  body = E'Welcome to the team.\n\nVident Productions is built on show-up energy, clear communication, and taking care of every client like they are the only event that night.\n\nIn this short course you will learn where to find Hub tools, how first-week checklists work, and who to ask when you are stuck.\n\nTip: keep My Week and Teams open during your first events — that is where day-of links and department videos live.'
where id = 'b1000000-0000-4000-8000-000000000001'
  and title ilike '%Y?%Entertainment%';
