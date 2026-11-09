-- Publish AV Ops Essentials with thin written lessons.

insert into public.training_courses (
  id, slug, title, blurb, audience, status, sort_order
) values (
  'a1000000-0000-4000-8000-000000000005',
  'av-ops',
  'AV Ops Essentials',
  'Gear check, load-in, time clock, Vident AV, and Hub wrap-up for AV calls.',
  'AV',
  'published',
  50
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
    'b5000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000005',
    10,
    'Before you leave for the venue',
    E'Run this AV check before every call:\n\n1. Confirm the Current RMS / Hub booking details (gear list, load-in, contact).\n2. Pack listed gear plus spares: power, adapters, tape, multi-tool, spare cables.\n3. Test critical pieces (mics, speakers, laptop/switcher) before you drive when you can.\n4. Know parking, dock, and who meets you on site.\n5. Confirm timeline highlights with your lead if anything looks unclear on the calendar.\n\nIf gear is missing or the list does not match the room, text your lead before you leave — do not discover it at the venue.',
    '/my-week',
    'Check My Week events'
  ),
  (
    'b5000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000005',
    20,
    'Load-in, power, and room share',
    E'On arrival:\n\n- Find power that will not get unplugged by catering or cleaning.\n- Keep guest walkways clear; tape cables where people cross.\n- Place speakers / screens so DJ sightlines and dance floor still work.\n- Talk to DJ and Photobooth before claiming space — share the room, do not fight for it.\n- Do a quiet systems check before guests arrive; bring levels up with the room in mind.\n\nNever leave valuable gear unattended in an unlocked room or vehicle.',
    '/teams',
    'Open Teams (AV)'
  ),
  (
    'b5000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000005',
    30,
    'Clock in and check Vident AV',
    E'Use the Hub for day-of tracking:\n\n1. Teams → AV → Time Tracker: prefer From Calendar when your DJEP events show up, or Manual Entry if the feed is empty.\n2. Clock in when you start work on site; clock out when you leave. GPS may be recorded when available.\n3. Vident AV (/rentals) shows live inventory and bookings from Current RMS (admins or AV department). Use it to confirm what should be on the truck — it is read-only against Current RMS.\n4. If the calendar list is empty, ask an admin to set the company feed or paste your DJEP Calendar Link on People.\n\nClean time entries help the office understand who was on which call.',
    '/teams',
    'Open Teams Time Tracker'
  ),
  (
    'b5000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000005',
    40,
    'During the event — professionalism basics',
    E'While the event is live:\n\n- Stay guest-facing when clients or guests are nearby; phone use stays out of sight.\n- Protect hearing and watch levels in small rooms.\n- Own problems early — escalate to your lead instead of hiding issues.\n- Never argue with a guest about setup; escalate politely.\n- Keep the work area tidy; no open drinks on mixers / laptops.\n- If gear fails, switch to backup calmly and notify your lead.\n\nYou represent Y? Entertainment every time a guest walks past the tech area.',
    '',
    ''
  ),
  (
    'b5000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000005',
    50,
    'Strike, load-out, and Event Packets',
    E'After the last cue:\n\n1. Power down in a safe order; coil cables so the next tech is not fighting knots.\n2. Sweep for left-behind adapters, mics, and tape scraps.\n3. Thank venue staff when you can — they remember who is easy to work with.\n4. Load the vehicle so nothing sits in an unlocked room.\n5. Same-night or next-morning: open your Event Packet, upload media, and mark complete. Flag Follow-up needed if the office must chase something.\n\nIncomplete packets become overdue the day after the event — My Week and the bell will remind you.',
    '/event-packets',
    'Open Event Packets'
  ),
  (
    'b5000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-000000000005',
    60,
    'Where AV help lives in the Hub',
    E'When you need more than this course:\n\n- Teams → AV for tutorials, planning links, and the Time Tracker.\n- Vident AV for stock and bookings (AV department or admin).\n- Training Portal for written courses and your progress.\n- Support Guide / Ask the Hub for “where is that tool?” questions.\n- People → Onboarding for AV new-hire forms once an admin pastes links.\n- Calendar / My Week for upcoming calls.\n\nDay-of judgment calls go to your AV lead — ask early, not after doors open.',
    '/rentals',
    'Open Vident AV'
  )
on conflict (id) do nothing;
