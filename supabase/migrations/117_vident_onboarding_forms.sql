-- Replace legacy Y Entertainment onboarding form cards with Vident department forms.
-- Keeps any URLs already pasted on av-onboarding-form / office-onboarding-form /
-- av-interview-questions when those rows already exist.

delete from public.onboarding_resources
where slug in (
  'dj-onboarding-form',
  'onboarding-checklist',
  'photobooth-onboarding-form',
  'audiovisual-onboarding-form',
  'audiovisual-interview-questions'
);

insert into public.onboarding_resources (slug, title, description, url, sort_order)
values
  (
    'corporate-onboarding-form',
    'Corporate Onboarding Form',
    'Complete the Corporate team onboarding form',
    '',
    10
  ),
  (
    'wedding-social-onboarding-form',
    'Weddings & Social Onboarding Form',
    'Complete the Weddings & Social team onboarding form',
    '',
    20
  ),
  (
    'golf-onboarding-form',
    'Golf Onboarding Form',
    'Complete the Golf team onboarding form',
    '',
    30
  ),
  (
    'av-onboarding-form',
    'AV Onboarding Form',
    'Complete the AV team onboarding form',
    '',
    40
  ),
  (
    'office-onboarding-form',
    'Office Onboarding Form',
    'Complete the Office new hire onboarding form',
    '',
    50
  ),
  (
    'av-interview-questions',
    'Interview Questions - AV',
    'AV interview questions document',
    '',
    60
  )
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();
