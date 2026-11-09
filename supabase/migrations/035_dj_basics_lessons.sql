-- Publish DJ Setup Essentials with thin written lessons.

update public.training_courses
set
  status = 'published',
  blurb = 'Gear check, room layout, walk-in workflow, and Hub wrap-up after DJ events.',
  updated_at = now()
where slug = 'dj-basics';

insert into public.training_lessons (
  id, course_id, sort_order, title, body, resource_href, resource_label
) values
  (
    'b2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    10,
    'Before you leave home',
    E'Run this gear check before every DJ call:\n\n1. Controllers / mixer / laptop charged or powered and tested.\n2. Primary + backup music library available offline if venue Wi‑Fi is weak.\n3. Cables: power, XLR/TRS as needed, spare RCA/adapter kit.\n4. Mic + spare cable, headphones, tape, multi-tool.\n5. Confirm load-in time, parking, and contact on the calendar event.\n\nIf anything is missing, text your lead before you drive — do not discover it at the venue.',
    '/my-week',
    'Check My Week events'
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000002',
    20,
    'Room layout & sound check',
    E'On arrival:\n\n- Find power that will not get unplugged by catering or cleaning.\n- Place the booth so you can see the dance floor and the client.\n- Keep guest walkways clear; tape cables where people cross.\n- Sound check quietly first, then bring levels up with the room in mind.\n- Confirm wireless mics work and spare batteries are on the table.\n\nLeave space for photobooth / AV if they share the room — talk to the other tech before moving furniture.',
    '/teams',
    'Open Teams (DJ tutorials)'
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000002',
    30,
    'Walk-in & first-hour workflow',
    E'The first hour sets the night:\n\n1. Greet the coordinator / couple contact and confirm timeline highlights.\n2. Confirm special dances, announcements, and do-not-play notes.\n3. Keep walk-in energy appropriate to the room — read the crowd, not your playlist ego.\n4. Stay guest-facing when clients are nearby; phone use stays out of sight.\n5. If the timeline slips, tell the lead early instead of catching up in panic.\n\nDocument anything unusual (late start, venue restrictions, guest issues) for the Event Packet later.',
    '',
    ''
  ),
  (
    'b2000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000002',
    40,
    'During the event — professionalism basics',
    E'While the event is live:\n\n- Water and breaks without leaving the booth unattended at peak moments.\n- Never argue with a guest about music — escalate politely to the lead or coordinator.\n- Protect hearing; watch levels if the room is small.\n- Keep the booth tidy; no open drinks on controllers.\n- If gear fails, switch to backup calmly and notify your lead.\n\nYou represent Y? Entertainment every time a guest walks past the booth.',
    '',
    ''
  ),
  (
    'b2000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000002',
    50,
    'Strike, load-out, and leaving the room better',
    E'After the last song:\n\n1. Power down in a safe order; coil cables so the next tech is not fighting knots.\n2. Sweep for left-behind adapters, mics, and gaffer tape scraps.\n3. Thank venue staff when you can — they remember who is easy to work with.\n4. Load the vehicle so nothing is left in an unlocked room.\n5. Same-night or next-morning: open your Event Packet and finish wrap-up.\n\nIncomplete packets become overdue the day after the event.',
    '/event-packets',
    'Open Event Packets'
  ),
  (
    'b2000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-000000000002',
    60,
    'Where DJ help lives in the Hub',
    E'Use these Hub spots when you need more than this course:\n\n- Teams → DJ for tutorial videos and planning links.\n- Training Portal for written courses and your progress.\n- Support Guide / Ask the Hub for “where is that tool?” questions.\n- People → Onboarding for new-hire Google forms once an admin pastes links.\n- Calendar / My Week for your upcoming calls.\n\nWhen client or day-of questions are sticky, text your DJ lead — do not guess on timeline changes.',
    '/teams',
    'Open Teams'
  )
on conflict (id) do nothing;
