-- Vident: remove Y?-specific / DJ / Photobooth seeded training courses.
-- The base schema (034–039, 099) seeds Y?'s DJ/Photobooth/AV/Office ops and
-- university tracks. Vident starts with a clean training catalog (keeps only the
-- generic "onboarding" course). training_lessons + completions cascade on delete.
delete from public.training_courses where slug in (
  'dj-basics',
  'client-planning',
  'photobooth',
  'av-ops',
  'office-ops',
  'dj-university',
  'pro-av-university',
  'photobooth-university'
);
