-- Publish Photobooth Ops with thin written lessons.

update public.training_courses
set
  status = 'published',
  blurb = 'Booth setup, props, guest flow, and Hub wrap-up after Photobooth events.',
  updated_at = now()
where slug = 'photobooth';

insert into public.training_lessons (
  id, course_id, sort_order, title, body, resource_href, resource_label
) values
  (
    'b4000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000004',
    10,
    'Before you leave for the venue',
    E'Run this Photobooth check before every call:\n\n1. Camera / iPad / printer charged or powered and tested.\n2. Backdrop, stands, and clips packed; spare bulbs / batteries if you use them.\n3. Props cleaned and packed so nothing is sticky or broken for guests.\n4. Tape, scissors, multi-tool, and spare print paper / ink as needed.\n5. Confirm load-in time, parking, and contact on the calendar event.\n\nIf anything is missing, text your lead before you drive — do not discover it at the venue.',
    '/my-week',
    'Check My Week events'
  ),
  (
    'b4000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000004',
    20,
    'Booth setup & room share',
    E'On arrival:\n\n- Find power that will not get unplugged mid-event.\n- Place the booth where the line will not block exits or the dance floor.\n- Keep cables taped; give guests a clear in/out path.\n- If DJ or AV share the room, talk before you claim space — do not block their sightlines or speakers.\n- Test a sample print / capture before guests arrive.\n\nLeave a tidy prop table; messy props slow the line and look unprofessional.',
    '/teams',
    'Open Teams (Photobooth)'
  ),
  (
    'b4000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000004',
    30,
    'Guest flow & hospitality',
    E'During open booth hours:\n\n1. Greet guests; keep the line moving without rushing people off the frame.\n2. Help with props when needed; reset the table between groups.\n3. Watch for kids near cables / stands — safety first.\n4. Stay guest-facing; phone use stays out of sight.\n5. If the printer jams or capture fails, apologize calmly, fix it, and notify your lead if downtime grows.\n\nYou are part of the celebration — energy and kindness matter as much as the prints.',
    '',
    ''
  ),
  (
    'b4000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000004',
    40,
    'Props, branding, and do-nots',
    E'Keep the brand and guest experience clean:\n\n- Use company-approved props and backdrops unless the lead says otherwise.\n- Do not let guests write on or damage props/backdrop.\n- Avoid inappropriate prop jokes with kids or formal events — read the room.\n- Never leave the booth unattended with valuables or an unlocked tablet.\n- If a guest asks for something outside policy (extra hours, off-menu edits), loop your lead.\n\nDocument odd requests or incidents for the Event Packet later.',
    '',
    ''
  ),
  (
    'b4000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000004',
    50,
    'Strike, load-out, and Event Packets',
    E'After the booth closes:\n\n1. Power down safely; pack props so the next event is not fighting tangles.\n2. Sweep for leftover prints, props, and tape scraps.\n3. Thank venue staff when you can.\n4. Load the vehicle so nothing sits in an unlocked room.\n5. Same-night or next-morning: open your Event Packet, upload photos/videos, and mark complete.\n\nIncomplete packets become overdue the day after the event — My Week and the bell will remind you.',
    '/event-packets',
    'Open Event Packets'
  ),
  (
    'b4000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-000000000004',
    60,
    'Where Photobooth help lives in the Hub',
    E'When you need more than this course:\n\n- Teams → Photobooth for tutorial videos and planning links.\n- Training Portal for written courses and your progress.\n- Support Guide / Ask the Hub for “where is that tool?” questions.\n- People → Onboarding for new-hire forms once an admin pastes links.\n- Calendar / My Week for your upcoming calls.\n\nDay-of judgment calls go to your Photobooth lead — ask early, not after the line forms.',
    '/teams',
    'Open Teams'
  )
on conflict (id) do nothing;
