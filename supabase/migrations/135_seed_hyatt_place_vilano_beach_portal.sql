-- PLACEHOLDER test data for the Hyatt Place Vilano Beach quote portal.
-- Every space, price, rate and add-on below is a stand-in to exercise the
-- wizard. Replace with real values (admin screen) before publishing.
-- The portal is created UNPUBLISHED: only signed-in admins can preview it at
-- /quote/hyatt-place-vilano-beach. Safe to re-run (skips if the slug exists).

do $$
declare
  pid uuid;
  gs uuid;
  pp uuid;
  pa uuid;
begin
  if exists (select 1 from public.venue_portals where slug = 'hyatt-place-vilano-beach') then
    return;
  end if;

  insert into public.venue_portals (
    slug, name, headline, intro, delivery_fee, tech_hourly_rate,
    savings_label, savings_pct, is_published
  ) values (
    'hyatt-place-vilano-beach',
    'Hyatt Place Vilano Beach',
    'Build your AV package',
    'PLACEHOLDER INTRO: Plan your meeting, celebration or conference with in-house audiovisual from Vident Productions. Choose your space, pick a package, and see your estimate instantly.',
    100, 100, 'Venue Partner Savings', 5, false
  ) returning id into pid;

  insert into public.venue_portal_spaces (portal_id, name, capacity, is_custom_quote, sort_order) values
    (pid, 'Ballroom (placeholder)', 150, false, 1),
    (pid, 'Meeting Room A (placeholder)', 40, false, 2),
    (pid, 'Boardroom (placeholder)', 12, true, 3);

  insert into public.venue_portal_packages
    (portal_id, name, tagline, price, setup_fee, includes_technician, is_popular, sort_order)
  values (pid, 'Projector Presentation', 'Big-screen presenting for meeting rooms', 400, 100, false, false, 1)
  returning id into pp;
  insert into public.venue_portal_packages
    (portal_id, name, tagline, price, setup_fee, includes_technician, is_popular, sort_order)
  values (pid, 'Presenter Audio', 'Be heard by every seat', 400, 100, false, false, 2)
  returning id into pa;
  insert into public.venue_portal_packages
    (portal_id, name, tagline, price, setup_fee, includes_technician, is_popular, sort_order)
  values (pid, 'General Session', 'Keynotes, annual meetings and large rooms', 1200, 200, true, true, 3)
  returning id into gs;

  insert into public.venue_portal_package_items (package_id, label, sort_order) values
    (pp, 'Projector (placeholder)', 1), (pp, 'Screen (placeholder)', 2), (pp, 'Table power and clicker', 3),
    (pa, 'Podium microphone', 1), (pa, '2 wireless handheld mics', 2), (pa, 'Laptop audio connection', 3), (pa, 'Powered speaker with mixer', 4),
    (gs, 'Projector, screen and confidence monitor', 1), (gs, 'Podium mic, 2 handhelds and a lapel mic', 2),
    (gs, '2 powered speakers with mixer', 3), (gs, 'On-site technician', 4);

  insert into public.venue_portal_addons
    (portal_id, name, description, unit_price, price_unit, min_quantity, max_quantity, is_orderable, note, sort_order)
  values
    (pid, 'Extra wireless handheld mic', 'Wireless handheld microphone', 85, 'each', 0, 10, true, '', 1),
    (pid, 'Extra table power', 'One power run to a table', 35, 'each', 0, 20, true, '', 2),
    (pid, 'Tabletop (presidential) mic', 'Gooseneck mic for a head table or panel', 60, 'each', 0, 10, true, '', 3),
    (pid, 'Wireless lapel mic', 'Clip-on mic for a presenter', 100, 'each', 0, 10, true, '', 4),
    (pid, 'On-site technician', 'Technician on site for your event', 100, 'hour', 2, 24, true, '', 5),
    (pid, 'Extra powered speaker', 'Speaker for overflow or a second zone', 55, 'each', 0, 10, true, '', 6),
    (pid, 'Laptop', 'Presentation laptop', 75, 'flat', 0, 5, true, '', 7),
    (pid, 'Confidence monitor', 'Screen facing the presenter', 120, 'flat', 0, 3, true, '', 8),
    (pid, 'HDMI splitter', 'Sends one source to several screens', 10, 'flat', 0, 5, true, '', 9),
    (pid, 'Slide clicker', 'Wireless slide advancer', 50, 'flat', 0, 5, false, 'Already included in every package.', 10),
    (pid, 'Uplights', 'Wireless color uplight', 25, 'each', 0, 40, true, '', 11);

  insert into public.venue_portal_enhancements (portal_id, name, description, sort_order) values
    (pid, 'Corporate Event Production', 'Full-service production for meetings, conferences and company events. (placeholder)', 1),
    (pid, 'Wedding & Social Events', 'Production and day-of support for weddings and celebrations. (placeholder)', 2),
    (pid, 'Lighting & Staging', 'Stage, lighting and atmosphere to set the room. (placeholder)', 3);
end $$;
