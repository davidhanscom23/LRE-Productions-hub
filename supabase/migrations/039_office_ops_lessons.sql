-- Publish Office Ops Essentials with thin written lessons.

insert into public.training_courses (
  id, slug, title, blurb, audience, status, sort_order
) values (
  'a1000000-0000-4000-8000-000000000006',
  'office-ops',
  'Office Ops Essentials',
  'Hub day-to-day for office staff: People, Calendar, packets, handbook, and Ask.',
  'Office',
  'published',
  60
)
on conflict (slug) do update
set
  title = excluded.title,
  blurb = excluded.blurb,
  audience = excluded.audience,
  status = 'published',
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.training_lessons (
  id, course_id, sort_order, title, body, resource_href, resource_label
) values
  (
    'b6000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000006',
    10,
    'Your Hub home base',
    E'Office work runs through the Hub more than the field apps.\n\nStart each day with:\n\n1. Home — company feed, shortcuts, and team celebrations when they appear.\n2. My Week — your tasks and (if you have calendar access) upcoming events.\n3. Top-bar search — jump to people, packets, resources, and training courses.\n4. Notifications bell — packet assignments, overdue reminders, marketing approvals.\n\nAppearance (light / dark / system) lives in the top bar and follows your account.',
    '/my-week',
    'Open My Week'
  ),
  (
    'b6000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000006',
    20,
    'People, invites, and onboarding links',
    E'People is the directory for who is on the team.\n\n- Browse Directory, Birthdays, Anniversaries, Org Chart, and Onboarding.\n- Admins invite via Add person (opens Supabase Auth Users), then edit the profile for departments, title, birthday, start date, and DJEP Calendar Link.\n- Staff/trainers need a personal DJEP feed for Calendar and My Week events — flag missing links from the Directory banner.\n- Onboarding tab: paste Google Form/Sheet/Doc URLs so new hires only see cards that already have links.\n\nKeep profiles accurate — Calendar matching and org chart managers depend on them.',
    '/people',
    'Open People'
  ),
  (
    'b6000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000006',
    30,
    'Calendar and company DJEP feed',
    E'Admins own the company DJEP “All Staff” iCal URL on Calendar (stored server-side; not shown again after save).\n\n- Day / Week / Month / Year views and Go to date help you find events fast.\n- Staff only see Calendar after an admin pastes their personal DJEP link on People.\n- Sync from calendar on Event Packets (or the daily cron) creates assignee packets from past/day-of events.\n\nIf someone says “I have no events,” check company feed (admins) or their People DJEP Calendar Link first.',
    '/calendar',
    'Open Calendar'
  ),
  (
    'b6000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000006',
    40,
    'Event Packets and Marketing awareness',
    E'Event Packets are the wrap-up path after calendar-assigned events.\n\n- Assignees complete the form, upload media, and mark complete (creates a linked End of Event Report).\n- Incomplete packets become overdue the day after the event — Tracking (admins) shows progress, overdue, and follow-up flags.\n- Follow-up needed on a packet notifies admins so the office can chase client or ops issues.\n- Completed packets with social consent feed Social Studio and Marketing Queue drafts.\n\nYou do not need to post social yourself — know where drafts and approvals live so you can help marketers and field staff.',
    '/event-packets',
    'Open Event Packets'
  ),
  (
    'b6000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000006',
    50,
    'Staff Handbook and company knowledge',
    E'Policy and how-tos live in the Hub:\n\n1. Staff Handbook — read and acknowledge the published revision; admins edit/publish and see the acknowledgement roster.\n2. Resources — shared files and links (admins/trainers add and edit metadata).\n3. Support Guide — browsable Hub playbooks by topic.\n4. Ask the Hub — free-form questions against indexed articles (admins Rebuild index after guide changes).\n\nWhen someone asks “where is that tool?”, point them to Support Guide or Ask before inventing a new process.',
    '/staff-handbook',
    'Open Staff Handbook'
  ),
  (
    'b6000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-000000000006',
    60,
    'When to escalate',
    E'Office Ops succeeds when issues move early:\n\n- Auth / invite problems → admin + Supabase Auth Users.\n- Missing calendar events → company feed or personal DJEP link on People.\n- Packet overdue / follow-up → Event Packets Tracking and the assignee.\n- Social / marketing approval stuck → Marketing Queue + admins on the bell.\n- Policy questions → Staff Handbook, then a manager if still unclear.\n- Product bugs or “the Hub is broken” → admin + Support Guide / Ask notes.\n\nDocument what you did in Chat or the packet notes so the next person is not starting from zero.',
    '/support-guide',
    'Open Support Guide'
  )
on conflict (id) do nothing;
