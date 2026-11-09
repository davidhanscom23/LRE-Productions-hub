-- Hub Points / gamification: achievements, ledger, balances, daily check-ins.

create table if not exists public.hub_achievements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  description text not null default '',
  points integer not null default 0 check (points >= 0),
  -- easy / medium / hard / legendary — drives UI + higher rewards
  difficulty text not null default 'easy'
    check (difficulty in ('easy', 'medium', 'hard', 'legendary')),
  category text not null default 'general'
    check (category in ('daily', 'discover', 'social', 'learn', 'field', 'admin', 'easter', 'general')),
  repeatable boolean not null default false,
  -- For path-based discovery awards (null = not a discover achievement)
  discover_path text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists hub_achievements_active_idx
  on public.hub_achievements (is_active, sort_order);
create index if not exists hub_achievements_discover_path_idx
  on public.hub_achievements (discover_path)
  where discover_path is not null;

create table if not exists public.hub_point_balances (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  points integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_checkin_day date,
  updated_at timestamptz not null default now()
);

create table if not exists public.hub_point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid references public.hub_achievements (id) on delete set null,
  points integer not null,
  reason text not null default '',
  meta jsonb not null default '{}'::jsonb,
  awarded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hub_point_events_user_created_idx
  on public.hub_point_events (user_id, created_at desc);
create index if not exists hub_point_events_created_idx
  on public.hub_point_events (created_at desc);

create table if not exists public.hub_user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.hub_achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table if not exists public.hub_daily_checkins (
  day date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  streak integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (day, user_id)
);

create index if not exists hub_daily_checkins_user_day_idx
  on public.hub_daily_checkins (user_id, day desc);

alter table public.hub_achievements enable row level security;
alter table public.hub_point_balances enable row level security;
alter table public.hub_point_events enable row level security;
alter table public.hub_user_achievements enable row level security;
alter table public.hub_daily_checkins enable row level security;

-- Achievements catalog: everyone can read; admins manage
drop policy if exists "hub_achievements read" on public.hub_achievements;
create policy "hub_achievements read"
  on public.hub_achievements for select to authenticated
  using (true);

drop policy if exists "hub_achievements admin write" on public.hub_achievements;
create policy "hub_achievements admin write"
  on public.hub_achievements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Leaderboard is public to staff (balances readable by all authenticated)
drop policy if exists "hub_point_balances read" on public.hub_point_balances;
create policy "hub_point_balances read"
  on public.hub_point_balances for select to authenticated
  using (true);

drop policy if exists "hub_point_balances admin write" on public.hub_point_balances;
create policy "hub_point_balances admin write"
  on public.hub_point_balances for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Events: own + admin; leaderboard may show recent reasons via admin tools
drop policy if exists "hub_point_events read own or admin" on public.hub_point_events;
create policy "hub_point_events read own or admin"
  on public.hub_point_events for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "hub_point_events admin write" on public.hub_point_events;
create policy "hub_point_events admin write"
  on public.hub_point_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "hub_user_achievements read" on public.hub_user_achievements;
create policy "hub_user_achievements read"
  on public.hub_user_achievements for select to authenticated
  using (true);

drop policy if exists "hub_user_achievements admin write" on public.hub_user_achievements;
create policy "hub_user_achievements admin write"
  on public.hub_user_achievements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "hub_daily_checkins read own or admin" on public.hub_daily_checkins;
create policy "hub_daily_checkins read own or admin"
  on public.hub_daily_checkins for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "hub_daily_checkins admin write" on public.hub_daily_checkins;
create policy "hub_daily_checkins admin write"
  on public.hub_daily_checkins for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.hub_achievements to authenticated;
grant select, insert, update, delete on public.hub_point_balances to authenticated;
grant select, insert, update, delete on public.hub_point_events to authenticated;
grant select, insert, update, delete on public.hub_user_achievements to authenticated;
grant select, insert, update, delete on public.hub_daily_checkins to authenticated;

-- Seed achievements (idempotent on key)
insert into public.hub_achievements
  (key, title, description, points, difficulty, category, repeatable, discover_path, sort_order)
values
  -- Daily / streaks
  ('daily_login', 'Daily check-in', 'Open the Hub today', 5, 'easy', 'daily', true, null, 10),
  ('streak_3', '3-day streak', 'Check in 3 days in a row', 25, 'easy', 'daily', false, null, 20),
  ('streak_7', 'Week warrior', 'Check in 7 days in a row', 75, 'medium', 'daily', false, null, 30),
  ('streak_14', 'Two-week torch', 'Check in 14 days in a row', 150, 'hard', 'daily', false, null, 40),
  ('streak_30', 'Month of momentum', 'Check in 30 days in a row', 400, 'legendary', 'daily', false, null, 50),
  ('streak_60', 'Unstoppable', 'Check in 60 days in a row', 750, 'legendary', 'daily', false, null, 60),
  ('streak_100', 'Century club', 'Check in 100 days in a row', 1500, 'legendary', 'daily', false, null, 70),

  -- Easy discovery
  ('discover_ask', 'Ask the Hub', 'Visit Ask the Hub', 10, 'easy', 'discover', false, '/ask', 100),
  ('discover_for_you', 'For You', 'Open For You', 10, 'easy', 'discover', false, '/for-you', 110),
  ('discover_my_week', 'My Week', 'Open My Week', 10, 'easy', 'discover', false, '/my-week', 120),
  ('discover_chat', 'Team Chat', 'Open Chat', 10, 'easy', 'discover', false, '/chat', 130),
  ('discover_people', 'People', 'Open People', 10, 'easy', 'discover', false, '/people', 140),
  ('discover_teams', 'Teams', 'Open Teams', 10, 'easy', 'discover', false, '/teams', 150),
  ('discover_training', 'Training Portal', 'Open Training Portal', 10, 'easy', 'discover', false, '/training-portal', 160),
  ('discover_resources', 'Resources', 'Open Resources', 10, 'easy', 'discover', false, '/resources', 170),
  ('discover_kudos', 'Kudos', 'Open Kudos', 10, 'easy', 'discover', false, '/kudos', 180),
  ('discover_polls', 'Polls', 'Open Polls', 10, 'easy', 'discover', false, '/polls', 190),
  ('discover_music_charts', 'Music Charts', 'Open Music Charts', 10, 'easy', 'discover', false, '/music-charts', 200),
  ('discover_support_guide', 'Support Guide', 'Open Support Guide', 10, 'easy', 'discover', false, '/support-guide', 210),
  ('discover_announcements', 'Announcements', 'Open Announcements', 10, 'easy', 'discover', false, '/announcements', 220),
  ('discover_points', 'Hub points guide', 'Open the Hub points tips page', 10, 'easy', 'discover', false, '/points', 225),

  -- Medium discovery
  ('discover_event_packets', 'Event Packets', 'Open Event Packets', 25, 'medium', 'discover', false, '/event-packets', 300),
  ('discover_social_studio', 'Social Studio', 'Open Social Studio', 25, 'medium', 'discover', false, '/social-studio', 310),
  ('discover_calendar', 'Calendar', 'Open Calendar', 25, 'medium', 'discover', false, '/calendar', 320),
  ('discover_time_off', 'Time Off', 'Open Time Off', 25, 'medium', 'discover', false, '/time-off', 330),
  ('discover_expenses', 'Expenses', 'Open Expenses', 25, 'medium', 'discover', false, '/expenses', 340),
  ('discover_handbook', 'Staff Handbook', 'Open Staff Handbook', 25, 'medium', 'discover', false, '/staff-handbook', 350),
  ('discover_action_center', 'Action Center', 'Open Action Center', 25, 'medium', 'discover', false, '/action-center', 360),
  ('discover_directory', 'Directory', 'Open Directory', 25, 'medium', 'discover', false, '/directory', 370),
  ('discover_reviews', 'Reviews', 'Open Reviews', 25, 'medium', 'discover', false, '/reviews', 380),
  ('discover_onboarding', 'Onboarding', 'Open Onboarding', 25, 'medium', 'discover', false, '/onboarding', 390),
  ('discover_eoe', 'End of Event Report', 'Open End of Event Report', 25, 'medium', 'discover', false, '/end-of-event-report', 400),
  ('discover_submit_photos', 'Submit Event Photos', 'Open Submit Event Photos', 25, 'medium', 'discover', false, '/submit-event-photos', 410),

  -- Hard discovery (less common / gated modules)
  ('discover_marketing', 'Marketing Queue', 'Open Marketing Queue', 50, 'hard', 'discover', false, '/marketing', 500),
  ('discover_image_studio', 'Image Studio', 'Open Image Studio', 50, 'hard', 'discover', false, '/image-studio', 510),
  ('discover_meetings', 'Meetings', 'Open Meetings', 50, 'hard', 'discover', false, '/meetings', 520),
  ('discover_staffing', 'Staffing', 'Open Staffing', 50, 'hard', 'discover', false, '/staffing', 530),
  ('discover_hiring', 'Hiring', 'Open Hiring', 50, 'hard', 'discover', false, '/hiring', 540),
  ('discover_hub_health', 'Hub health', 'Open Hub health', 50, 'hard', 'discover', false, '/hub-health', 550),
  ('discover_reports', 'Reports', 'Open Reports', 50, 'hard', 'discover', false, '/reports', 560),
  ('discover_content_sla', 'Content SLA', 'Open Content SLA', 50, 'hard', 'discover', false, '/content-sla', 570),
  ('discover_rentals', 'Rentals', 'Open Rentals', 50, 'hard', 'discover', false, '/rentals', 580),

  -- Social (once)
  ('first_kudos_given', 'Pay it forward', 'Give your first kudos', 40, 'medium', 'social', false, null, 600),

  -- Easter eggs (big awards — intentional finds)
  ('egg_clear_the_chambers', 'Clear the Chambers', 'Finish the Music Charts title-click mini-game', 500, 'legendary', 'easter', false, null, 700),
  ('egg_charts_chamber_reveal', 'Enter the Charts (36 Chambers)', 'Unlock the Music Charts chamber title morph', 350, 'legendary', 'easter', false, null, 710),
  ('egg_36th_chamber_badge', '36th Chamber', 'Earn the Training Portal chamber badge', 400, 'legendary', 'easter', false, null, 720),
  ('egg_wu_wednesday_popup', 'Happy Wu Wednesday', 'See the Wu Wednesday Home splash', 250, 'hard', 'easter', false, null, 730),
  ('egg_wu_spotify', 'Cue up 36 Chambers', 'Open Enter the Wu-Tang on Spotify from Home', 150, 'hard', 'easter', false, null, 740),
  ('egg_nine_minds', 'Nine minds', 'Spot the Nine Minds Day wink', 200, 'hard', 'easter', false, null, 750),
  ('egg_chamber_day', 'Chamber Day', 'Catch a Chamber Day on the Hub', 200, 'hard', 'easter', false, null, 760),
  ('egg_chamber_wisdom', 'Chamber wisdom', 'Find a Chamber wisdom quote on My Week', 200, 'hard', 'easter', false, null, 770)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  points = excluded.points,
  difficulty = excluded.difficulty,
  category = excluded.category,
  repeatable = excluded.repeatable,
  discover_path = excluded.discover_path,
  sort_order = excluded.sort_order,
  is_active = true;

-- Award a catalog achievement to the signed-in user (SECURITY DEFINER).
-- Returns jsonb: { awarded, points, key, title, streak?, message }
create or replace function public.award_hub_achievement(
  p_key text,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  a public.hub_achievements%rowtype;
  v_already boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('awarded', false, 'message', 'Not signed in');
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role = 'guest' then
    return jsonb_build_object('awarded', false, 'message', 'Guests cannot earn points');
  end if;

  select * into a from public.hub_achievements
  where key = p_key and is_active = true;
  if not found then
    return jsonb_build_object('awarded', false, 'message', 'Unknown achievement');
  end if;

  if not a.repeatable then
    select exists (
      select 1 from public.hub_user_achievements
      where user_id = v_uid and achievement_id = a.id
    ) into v_already;
    if v_already then
      return jsonb_build_object(
        'awarded', false,
        'points', 0,
        'key', a.key,
        'title', a.title,
        'message', 'Already unlocked'
      );
    end if;
  elsif a.key = 'daily_login' then
    -- Cap daily_login to once per America/New_York calendar day
    if exists (
      select 1
      from public.hub_point_events e
      where e.user_id = v_uid
        and e.achievement_id = a.id
        and (timezone('America/New_York', e.created_at))::date
          = (timezone('America/New_York', now()))::date
    ) then
      return jsonb_build_object(
        'awarded', false,
        'points', 0,
        'key', a.key,
        'title', a.title,
        'message', 'Already checked in today'
      );
    end if;
  end if;

  if not a.repeatable then
    insert into public.hub_user_achievements (user_id, achievement_id)
    values (v_uid, a.id)
    on conflict do nothing;
  end if;

  insert into public.hub_point_events (user_id, achievement_id, points, reason, meta)
  values (
    v_uid,
    a.id,
    a.points,
    a.title,
    coalesce(p_meta, '{}'::jsonb)
  );

  insert into public.hub_point_balances (user_id, points, updated_at)
  values (v_uid, a.points, now())
  on conflict (user_id) do update set
    points = public.hub_point_balances.points + excluded.points,
    updated_at = now();

  return jsonb_build_object(
    'awarded', true,
    'points', a.points,
    'key', a.key,
    'title', a.title,
    'difficulty', a.difficulty,
    'message', 'Awarded'
  );
end;
$$;

grant execute on function public.award_hub_achievement(text, jsonb) to authenticated;

-- Daily check-in in America/New_York; awards daily_login + streak milestones.
create or replace function public.hub_daily_checkin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_today date := (timezone('America/New_York', now()))::date;
  v_yesterday date := v_today - 1;
  v_streak integer := 1;
  v_prev integer := 0;
  v_awarded jsonb := '[]'::jsonb;
  v_result jsonb;
  v_total integer := 0;
  milestone text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'message', 'Not signed in');
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role = 'guest' then
    return jsonb_build_object('ok', false, 'message', 'Guests cannot check in');
  end if;

  -- Already checked in today?
  if exists (
    select 1 from public.hub_daily_checkins
    where user_id = v_uid and day = v_today
  ) then
    select current_streak, points into v_streak, v_total
    from public.hub_point_balances where user_id = v_uid;
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'streak', coalesce(v_streak, 0),
      'points', coalesce(v_total, 0),
      'awarded', '[]'::jsonb
    );
  end if;

  select current_streak into v_prev
  from public.hub_point_balances where user_id = v_uid;

  if exists (
    select 1 from public.hub_daily_checkins
    where user_id = v_uid and day = v_yesterday
  ) then
    v_streak := coalesce(v_prev, 0) + 1;
    if v_streak < 1 then v_streak := 1; end if;
  else
    v_streak := 1;
  end if;

  insert into public.hub_daily_checkins (day, user_id, streak)
  values (v_today, v_uid, v_streak);

  insert into public.hub_point_balances (
    user_id, points, current_streak, longest_streak, last_checkin_day, updated_at
  )
  values (v_uid, 0, v_streak, v_streak, v_today, now())
  on conflict (user_id) do update set
    current_streak = v_streak,
    longest_streak = greatest(public.hub_point_balances.longest_streak, v_streak),
    last_checkin_day = v_today,
    updated_at = now();

  -- Daily login points
  v_result := public.award_hub_achievement(
    'daily_login',
    jsonb_build_object('day', v_today::text, 'streak', v_streak)
  );
  if (v_result->>'awarded')::boolean then
    v_awarded := v_awarded || jsonb_build_array(v_result);
  end if;

  -- Streak milestones
  foreach milestone in array array['streak_3','streak_7','streak_14','streak_30','streak_60','streak_100']
  loop
    if (milestone = 'streak_3' and v_streak >= 3)
      or (milestone = 'streak_7' and v_streak >= 7)
      or (milestone = 'streak_14' and v_streak >= 14)
      or (milestone = 'streak_30' and v_streak >= 30)
      or (milestone = 'streak_60' and v_streak >= 60)
      or (milestone = 'streak_100' and v_streak >= 100)
    then
      v_result := public.award_hub_achievement(
        milestone,
        jsonb_build_object('streak', v_streak)
      );
      if (v_result->>'awarded')::boolean then
        v_awarded := v_awarded || jsonb_build_array(v_result);
      end if;
    end if;
  end loop;

  select points into v_total from public.hub_point_balances where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'streak', v_streak,
    'points', coalesce(v_total, 0),
    'awarded', v_awarded
  );
end;
$$;

grant execute on function public.hub_daily_checkin() to authenticated;

-- Discover a module by path (matches hub_achievements.discover_path).
create or replace function public.hub_discover_path(p_path text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_norm text;
begin
  v_norm := lower(trim(p_path));
  if v_norm = '' then
    return jsonb_build_object('awarded', false, 'message', 'Missing path');
  end if;
  -- Strip query/hash; keep first segment path like /ask or /event-packets
  v_norm := split_part(split_part(v_norm, '?', 1), '#', 1);
  if right(v_norm, 1) = '/' and length(v_norm) > 1 then
    v_norm := left(v_norm, length(v_norm) - 1);
  end if;

  select key into v_key
  from public.hub_achievements
  where is_active and discover_path = v_norm
  limit 1;

  if v_key is null then
    return jsonb_build_object('awarded', false, 'message', 'No achievement for path');
  end if;

  return public.award_hub_achievement(
    v_key,
    jsonb_build_object('path', v_norm)
  );
end;
$$;

grant execute on function public.hub_discover_path(text) to authenticated;

-- Admin manual grant (positive or negative).
create or replace function public.admin_grant_hub_points(
  p_user_id uuid,
  p_points integer,
  p_reason text default 'Admin award'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text;
  v_total integer;
  v_name text;
begin
  if v_uid is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Admins only');
  end if;
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Missing user');
  end if;
  if p_points = 0 then
    return jsonb_build_object('ok', false, 'message', 'Points cannot be zero');
  end if;
  if abs(p_points) > 100000 then
    return jsonb_build_object('ok', false, 'message', 'Points out of range');
  end if;

  select full_name into v_name from public.profiles where id = p_user_id and is_active;
  if v_name is null then
    return jsonb_build_object('ok', false, 'message', 'User not found');
  end if;

  v_reason := coalesce(nullif(trim(p_reason), ''), 'Admin award');

  insert into public.hub_point_events (user_id, achievement_id, points, reason, meta, awarded_by)
  values (
    p_user_id,
    null,
    p_points,
    v_reason,
    jsonb_build_object('manual', true),
    v_uid
  );

  insert into public.hub_point_balances (user_id, points, updated_at)
  values (p_user_id, p_points, now())
  on conflict (user_id) do update set
    points = public.hub_point_balances.points + excluded.points,
    updated_at = now();

  select points into v_total from public.hub_point_balances where user_id = p_user_id;

  insert into public.hub_notifications (user_id, kind, title, body, href)
  values (
    p_user_id,
    'info',
    case when p_points > 0 then 'You earned Hub points!' else 'Hub points adjusted' end,
    case
      when p_points > 0 then '+' || p_points::text || ' pts — ' || left(v_reason, 120)
      else p_points::text || ' pts — ' || left(v_reason, 120)
    end,
    '/'
  );

  return jsonb_build_object(
    'ok', true,
    'points', p_points,
    'total', coalesce(v_total, 0),
    'user_name', v_name,
    'message', 'Granted'
  );
end;
$$;

grant execute on function public.admin_grant_hub_points(uuid, integer, text) to authenticated;
