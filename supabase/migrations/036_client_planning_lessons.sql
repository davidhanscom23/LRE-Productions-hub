-- Publish Client Planning & DJEP with thin written lessons.

update public.training_courses
set
  status = 'published',
  blurb = 'Planning forms, music requests, DJEP tips, and client communication before the event.',
  updated_at = now()
where slug = 'client-planning';

insert into public.training_lessons (
  id, course_id, sort_order, title, body, resource_href, resource_label
) values
  (
    'b3000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003',
    10,
    'What Client Planning covers',
    E'Before the event night, planning is how we avoid surprises.\n\nThis course covers:\n\n1. Where client details live (DJEP + Calendar / My Week).\n2. How to review music requests and do-not-play notes.\n3. What to confirm with the couple / coordinator before walk-in.\n4. How Client Meetings policies in the Staff Handbook apply.\n5. Where to get help in the Hub when a plan is incomplete.\n\nGood planning makes Setup Essentials easier — you arrive already knowing the timeline.',
    '/my-week',
    'Open My Week'
  ),
  (
    'b3000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000003',
    20,
    'DJEP basics for assigned events',
    E'DJ Event Planner (DJEP) is the source of truth for assignments and many client planning fields.\n\nBefore each call:\n\n- Confirm you are the assigned DJ on the calendar event.\n- Open the event details and note venue, start times, and contacts.\n- Check whether a personal DJEP Calendar Link is on your People profile (admins paste this) so Calendar and My Week stay in sync.\n- If the Hub calendar is empty for you, ask an admin — do not guess from memory.\n\nNever invent timeline details that are not in DJEP or a written client message.',
    '/calendar',
    'Open Calendar'
  ),
  (
    'b3000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000003',
    30,
    'Music requests & do-not-play',
    E'Review music notes early — not at cocktail hour.\n\n1. Read must-play / special dance songs and confirm you have (or can get) clean versions.\n2. Honor do-not-play lists even if a guest asks mid-event; escalate politely if needed.\n3. Use Music Charts in the Hub for chart/playlist reference when building ideas — playback stays on Spotify/external sites.\n4. If a request conflicts with company or venue policy, loop in your lead before the event.\n\nWrite unclear requests down and clarify with the coordinator in writing when you can.',
    '/music-charts',
    'Open Music Charts'
  ),
  (
    'b3000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000003',
    40,
    'Client communication before the night',
    E'When you talk with clients or coordinators:\n\n- Be on time, professional, and clear — you represent Y? Entertainment.\n- Confirm announcement names, special dances, and any surprise moments.\n- Ask about cultural / family moments that are easy to miss on a form.\n- If something is missing in DJEP, say what you still need instead of winging it.\n- Keep text threads tidy; move big changes into DJEP notes or email when possible.\n\nStaff Handbook Client Meetings and event-expectation sections apply here — skim them if you have not yet.',
    '/staff-handbook',
    'Open Staff Handbook'
  ),
  (
    'b3000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000003',
    50,
    'Day-of handoff into Setup Essentials',
    E'Planning ends when walk-in starts — hand off cleanly:\n\n1. Arrive with timeline highlights and specials already reviewed.\n2. Confirm parking / load-in from the calendar notes.\n3. Greet the coordinator with a short check: “Any last changes?”\n4. Then follow DJ Setup Essentials (gear, layout, levels).\n5. After the event, finish the Event Packet so marketing and archives stay current.\n\nIf the plan changed last-minute, note it in the packet memorable-moment / notes so the office sees what happened.',
    '/training-portal/dj-basics',
    'Open DJ Setup Essentials'
  ),
  (
    'b3000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-000000000003',
    60,
    'Where planning help lives in the Hub',
    E'When planning is stuck:\n\n- Teams → DJ for tutorial videos and planning links.\n- Support Guide / Ask the Hub for “where is that tool?” questions.\n- People → Onboarding for new-hire forms once links are pasted.\n- Your DJ lead for client or timeline judgment calls.\n- Office / admin for DJEP access or calendar feed issues.\n\nDo not wait until load-in to ask — early questions protect the show.',
    '/teams',
    'Open Teams'
  )
on conflict (id) do nothing;
