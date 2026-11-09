-- 099 Training tracks seed: DJ, Pro AV, and Photobooth certification tracks.
-- Seeded as DRAFT courses (admin + trainer can preview/edit; staff can't see them
-- until published). Content is a first draft adapted from the reference tracks —
-- edit lesson bodies in the Training Portal manage view, then set status to
-- "published" when ready for the team. Idempotent: lessons insert only if a
-- course has none yet.

-- ---------------------------------------------------------------------------
-- Courses (fixed ids, new slugs so they don't collide with existing stubs)
-- ---------------------------------------------------------------------------
insert into public.training_courses (id, slug, title, blurb, audience, status, sort_order) values
  ('c1000000-0000-4000-8000-0000000000d1', 'dj-university',
   'Y? DJ University',
   'DRAFT — DJ certification: foundations through wedding specialist. Edit lessons, then publish.',
   'DJ', 'draft', 100),
  ('c1000000-0000-4000-8000-0000000000a1', 'pro-av-university',
   'Y? Pro AV University',
   'DRAFT — AV / event production certification: customer experience, safety, operations, technical, and leadership, plus a Fundamentals reference. Edit, then publish.',
   'AV', 'draft', 110),
  ('c1000000-0000-4000-8000-0000000000b1', 'photobooth-university',
   'Photobooth University',
   'DRAFT — Photobooth attendant certification: guest experience first, plus per-booth setup. Edit, then publish.',
   'Photobooth', 'draft', 120)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- DJ University lessons
-- ---------------------------------------------------------------------------
insert into public.training_lessons (course_id, sort_order, title, body)
select 'c1000000-0000-4000-8000-0000000000d1', v.so, v.title, v.body
from (values
  (10,  'Level 1 · Module 1 — The Y? Standard', E'What it means to represent Y? Entertainment: brand identity, time expectations (early is on time), mic presence, our zero-tolerance policies, and the decision filter we use when something is unclear.'),
  (20,  'Level 1 · Module 2 — Professionalism & Presence', E'How you carry yourself in front of clients and guests: appearance, body language, phone use, and staying guest-facing whenever anyone is nearby.'),
  (30,  'Level 1 · Module 3 — Gear Basics: The Y? Stack', E'The standard DJ stack we run: controller, speakers, subs, stands, cables, and backups. How it connects and how to set it up cleanly and safely.'),
  (40,  'Level 1 · Module 4 — Music Foundations', E'Genres, energy, BPM, and reading a room. Building a versatile library and understanding what works for each part of an event.'),
  (50,  'Level 1 · Module 5 — Mixing Essentials (No Flexing)', E'Clean, beat-matched transitions that serve the dance floor — not the DJ ego. Levels, EQ, and keeping the energy flowing.'),
  (60,  'Level 1 · Module 6 — Event Flow & Timelines', E'How a night is structured, how to read a timeline, and how to keep the event on track while staying flexible.'),
  (65,  'Level 1 · Module 6.5 — Microphone Fundamentals', E'Mic types, gain, feedback control, and clear handoffs. Sounding professional on the mic for announcements and toasts.'),
  (70,  'Level 1 · Module 7 — Client & Guest Interaction', E'Reading and responding to clients and guests with warmth and control. Handling requests and difficult moments gracefully.'),
  (80,  'Level 1 · Module 8 — Emergency & Failure Management', E'When gear fails or the timeline breaks: stay calm, have backups, and follow the recovery steps so guests never see the scramble.'),
  (90,  'Level 1 · Module 9 — Shadowing Requirements', E'What you need to observe and demonstrate while shadowing an experienced DJ before you lead your own event.'),
  (100, 'Level 1 · Module 10 — Level 1 Certification', E'Level 1 checkpoint: demonstrate the standard, gear setup, mixing basics, and event flow to earn Foundations certification.'),
  (110, 'Level 2 · Module 11 — Wedding DJ Mindset', E'The wedding DJ is the timeline owner and the room''s emotional guide. What changes when the event is a wedding.'),
  (120, 'Level 2 · Module 12 — Ceremony Execution', E'Ceremony audio, cues, and coordination: processional, readings, vows, and recessional done flawlessly.'),
  (130, 'Level 2 · Module 13 — Microphone Management & Voice Control', E'Managing multiple mics, wireless discipline, and your own announcing voice — pacing, tone, and clarity.'),
  (140, 'Level 2 · Module 14 — Formalities & Announcements', E'Grand entrance, first dance, toasts, cake, and other formalities: scripting, timing, and name pronunciation.'),
  (150, 'Level 2 · Module 15 — Timeline Ownership & Adaptation', E'Owning the wedding timeline and adapting in real time when things run early, late, or off-script.'),
  (160, 'Level 2 · Module 16 — Dance Floor Building (Wedding-Specific)', E'Building and sustaining a wedding dance floor across generations and tastes without clearing the room.'),
  (170, 'Level 2 · Module 17 — Requests & Crowd Control (Advanced)', E'Advanced request handling and crowd control: honoring the couple''s wishes while keeping energy high.'),
  (180, 'Level 2 · Module 18 — Working with Planners & Venues', E'Partnering with planners, coordinators, and venue staff so the whole vendor team runs smoothly.'),
  (190, 'Level 2 · Module 19 — Wedding Failure Scenarios', E'Common wedding-day failures and how to recover: audio drops, missing files, timeline collapse, and difficult guests.'),
  (200, 'Level 2 · Module 20 — Level 2 Certification', E'Level 2 checkpoint: demonstrate wedding-specialist skills to earn Wedding DJ Specialist certification.')
) as v(so, title, body)
where not exists (
  select 1 from public.training_lessons
  where course_id = 'c1000000-0000-4000-8000-0000000000d1'
);

-- ---------------------------------------------------------------------------
-- Photobooth University lessons (Core + per-booth)
-- ---------------------------------------------------------------------------
insert into public.training_lessons (course_id, sort_order, title, body)
select 'c1000000-0000-4000-8000-0000000000b1', v.so, v.title, v.body
from (values
  (10,  'Core · 1 — Welcome to Y? Entertainment', E'Who we are and what your role as a photobooth attendant really is: you create the guest experience, not just run a machine.'),
  (20,  'Core · 2 — The Y? Standard', E'Ownership, attitude, and the Five Guest Promises. The mindset that separates a great attendant from a booth babysitter.'),
  (30,  'Core · 3 — Five-Star Guest Experience', E'The SEE, INVITE, GUIDE, CELEBRATE, THANK framework — how to actively bring guests to the booth and make each one feel great.'),
  (40,  'Core · 4 — Five-Star Language', E'30+ approved phrases that change the room. What to say to invite, guide, and thank guests warmly and professionally.'),
  (50,  'Core · 5 — Professionalism', E'Appearance, phones, and working with the rest of the event team. Staying guest-facing and representing Y? well.'),
  (60,  'Core · 6 — Reading the Room', E'Adjusting your approach by event type and guest personality — weddings, corporate, mitzvahs, and everything between.'),
  (70,  'Core · 7 — Universal Booth Setup', E'Arrival through packing: the setup sequence that applies to every booth. Load-in, placement, power, test, and strike.'),
  (80,  'Core · 8 — DNP DS620A Printer', E'Media loading, test prints, cleaning, and reading the error lights so prints never stop during an event.'),
  (90,  'Core · 9 — Troubleshooting', E'Decision trees for the five most common failures — printer, software, camera, lighting, and network.'),
  (100, 'Core · 10 — Event Wrap-Up', E'Strike, venue walkthrough, and leaving a great last impression. Packing correctly so the next event is set up for success.'),
  (110, 'Booth · Luxe Social Share', E'Overview, setup, software, and guest flow for the Luxe Social Share booth.'),
  (120, 'Booth · Social Share', E'Overview, setup, software, and guest flow for the Social Share booth.'),
  (130, 'Booth · Mirror Booth', E'Calibration, touchscreen, animations, and guest interaction for the Mirror Booth.'),
  (140, 'Booth · Sketch Studio', E'Lighting, sketch timing, and presentation for Sketch Studio.'),
  (150, 'Booth · Selfie Roamer', E'Battery management, roaming technique, and crowd engagement for the Selfie Roamer.')
) as v(so, title, body)
where not exists (
  select 1 from public.training_lessons
  where course_id = 'c1000000-0000-4000-8000-0000000000b1'
);

-- ---------------------------------------------------------------------------
-- Pro AV University lessons (Customer Experience, Safety, Operations,
-- Technical Certifications, Event Leadership) + Fundamentals reference.
-- ---------------------------------------------------------------------------
insert into public.training_lessons (course_id, sort_order, title, body)
select 'c1000000-0000-4000-8000-0000000000a1', v.so, v.title, v.body
from (values
  -- Customer Experience Certification
  (10,  'CX · Welcome to Y? Production', E'Who we are, what we value, and why clients hire us for AV and event production.'),
  (20,  'CX · The Client Experience', E'What a five-star client experience looks like on an AV job, from first contact through load-out.'),
  (30,  'CX · Five-Star Communication', E'Clear, proactive communication with clients, planners, and the rest of the team.'),
  (40,  'CX · Reading the Room', E'Adjusting your presence and approach to the event type, client, and moment.'),
  (50,  'CX · Professional Presence', E'Appearance, demeanor, and staying guest-facing on site.'),
  (60,  'CX · Working During Load-In', E'How to conduct yourself during load-in: safety, coordination, and professionalism.'),
  (70,  'CX · The Event Mindset', E'Owning your role during the live event — anticipate, stay ready, and keep the show running.'),
  (80,  'CX · Problem Solving: STOP', E'The STOP method for solving problems calmly under pressure during an event.'),
  (90,  'CX · Working with Other Vendors', E'Partnering with planners, caterers, photographers, and venue staff.'),
  (100, 'CX · Event Wrap-Up', E'Strike, walkthrough, and leaving a great final impression.'),
  (110, 'CX · The Y? Standard', E'The standard we hold on every AV job — what "white glove" means for us.'),
  (120, 'CX · White Glove Service', E'Going beyond expectations: the details that make clients rebook and refer.'),
  (130, 'CX · The Last 5%', E'The final details that separate good from great — the last 5% guests remember.'),
  (140, 'CX · Final Certification', E'Customer Experience checkpoint: demonstrate the standard to certify.'),
  -- Safety
  (200, 'Safety · Safety Mindset', E'Safety is everyone''s job. The mindset and habits that keep crews and guests safe.'),
  (210, 'Safety · Safe Lifting & Material Handling', E'Proper lifting technique, team lifts, carts, and handling heavy or awkward gear.'),
  (220, 'Safety · Rigging & Overhead Safety', E'Overhead safety fundamentals — never work under an unsecured load.'),
  (230, 'Safety · Safety Cables', E'When and how to use safety cables on fixtures and hardware.'),
  (240, 'Safety · Cable Management & Trip Hazards', E'Running, taping, and ramping cable to eliminate trip hazards.'),
  (250, 'Safety · Sandbags & Equipment Stability', E'Weighting stands and structures for stability in wind and crowds.'),
  (260, 'Safety · Electrical & Power Safety', E'Power safety: circuits, loads, GFCI, and safe distribution.'),
  (270, 'Safety · Equipment Inspection', E'Inspecting cases, cables, and gear before every event.'),
  (280, 'Safety · Emergency Procedures', E'What to do in an emergency — evacuation, injury, and fire.'),
  (290, 'Safety · Near Miss Reporting', E'Why and how to report near misses so we fix hazards before someone is hurt.'),
  (300, 'Safety · Final Safety Certification', E'Safety checkpoint: demonstrate safe practices to certify.'),
  -- Operations
  (400, 'Ops · Warehouse Operations & Case Management', E'Pulling, staging, and returning gear; case management and inventory discipline.'),
  (410, 'Ops · Event Documentation & Photo Capture', E'Documenting setups and capturing photos for records and marketing.'),
  -- Technical Certifications
  (500, 'Tech · Audio Systems', E'Audio system design and setup: sources, mixers, amps, speakers, and gain structure.'),
  (510, 'Tech · Video Systems', E'Video sources, switchers, scalers, and displays.'),
  (520, 'Tech · LED Walls', E'LED wall panels, processors, pixel pitch, and assembly.'),
  (530, 'Tech · Lighting Systems', E'Lighting fixtures, DMX control, and design basics.'),
  (540, 'Tech · Camera Systems', E'Cameras, lenses, and capture for events and streaming.'),
  (550, 'Tech · Live Streaming', E'Encoders, bandwidth, platforms, and a reliable streaming workflow.'),
  (560, 'Tech · Power Distribution', E'Distro, phases, loads, and safe power planning for a show.'),
  -- Event Leadership
  (600, 'Lead · What Makes a Great Leader?', E'The qualities of a great event lead and why leadership matters on site.'),
  (610, 'Lead · Running an Event', E'Owning an event end to end as the lead.'),
  (620, 'Lead · Leading People', E'Directing and supporting your crew under pressure.'),
  (630, 'Lead · Client Leadership', E'Leading the client relationship on site with confidence and calm.'),
  (640, 'Lead · Time Management', E'Managing the clock across setup, show, and strike.'),
  (650, 'Lead · Decision Making', E'Making good calls quickly with incomplete information.'),
  (660, 'Lead · Crisis Management', E'Leading through failures and crises without losing the room.'),
  (670, 'Lead · Post Event Leadership', E'Wrap-up, debrief, and follow-through after the event.'),
  (680, 'Lead · Mentoring Others', E'Developing the next generation of leads and technicians.'),
  (690, 'Lead · Final Leadership Assessment', E'Leadership checkpoint: demonstrate leadership to certify.'),
  -- Fundamentals Resource Guide (reference)
  (700, 'Fundamentals · Connectors & Use Cases', E'Common AV connectors and where they''re used:\n- 3-Pin XLR: balanced mic/line signals.\n- 1/4" TS/TRS: TS unbalanced/instrument; TRS balanced line.\n- speakON: amplifier-to-speaker (speaker level).\n- Euroblock (Phoenix): fixed-install speakers and control.\n- RCA (Phono): unbalanced audio and SD video.\n- 3-Pin / 5-Pin DMX: lighting control.\n- HDMI: HD digital video + audio.\n- BNC: 75ohm SDI video; 50ohm antenna.\n- RJ45: networking and AV-over-IP.\n- USB-A/B/C: data, video, power (check cable specs).\n- powerCON / powerCON TRUE1 / IEC: AC power.\nEndpoints: wall plates, floor boxes, and stageboxes provide clean, organized connection points.'),
  (710, 'Fundamentals · Pinouts & Signal Types', E'XLR pinout (Pin 2 hot): 1 = ground, 2 = positive (+), 3 = negative (-).\nDMX pinout (Pin 3 hot): 1 = ground, 2 = data (-), 3 = data (+); 5-pin adds aux 4/5.\nspeakON: 1+ / 1- = Channel A; 2+ / 2- = Channel B (on 4-pole).\nTRS = tip/ring/sleeve (balanced); TS = tip/sleeve (unbalanced).\nBalanced (XLR, TRS): +, -, and ground — rejects noise over long runs.\nUnbalanced (RCA, TS): single signal + ground — noise-prone over distance.\nDigital (HDMI, SDI, USB, Dante/AVoIP): data-based — keeps quality over distance and enables high resolution.'),
  (720, 'Fundamentals · Cable Performance & Distance', E'Balanced XLR/TRS: up to ~300 ft (90 m), long-run reliable.\nUnbalanced RCA/TS: ~20-25 ft (6-8 m), short runs only.\nDMX lighting: up to ~1,000 ft (300 m) daisy-chained, needs termination.\nHDMI: passive ~33 ft (10 m); active ~66 ft (20 m); active optical ~330 ft (100 m). Higher resolutions travel shorter — use active/fiber past ~25-30 ft.\nCAT5e/CAT6/CAT6A: up to ~330 ft (100 m); CAT6 is the AV standard for Dante and AV-over-IP.'),
  (730, 'Fundamentals · Selection & Termination Guide', E'Quick selection:\n- Audio: XLR for balanced/long runs; TRS for balanced/stereo line.\n- Video: HDMI for short device-to-display; SDI for long production runs; CAT6 for networked/scalable.\n- Speakers: speakON amp-to-speaker.\n- Power: powerCON / TRUE1.\n- Network/AV: CAT6 for AV-over-IP and Dante.\nRJ45 standard: most AV/commercial uses T568B.\nTermination reference: Mic/XLR = solder; Line/TRS/TS = solder; CAT6/RJ45 = crimp; SDI/BNC = compression/crimp; speakON = screw or solder; Euroblock = screw terminal.'),
  (740, 'Fundamentals · Definitions Glossary', E'A quick reference of common terms across audio, video, lighting, and networking. (Draft — expand with the terms your crew asks about most: gain, headroom, Dante, AVoIP, pixel pitch, lumens, DMX universe, phantom power, impedance, latency, and more.)')
) as v(so, title, body)
where not exists (
  select 1 from public.training_lessons
  where course_id = 'c1000000-0000-4000-8000-0000000000a1'
);
