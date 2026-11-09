-- Hub Points earning rules: new achievements, per-entity uniqueness, daily caps,
-- For You clean streak, and award-to-user for cron / assignee awards.

-- ---------------------------------------------------------------------------
-- Achievement catalog extensions
-- ---------------------------------------------------------------------------

alter table public.hub_achievements
  add column if not exists unique_meta_field text,
  add column if not exists daily_count_cap integer
    check (daily_count_cap is null or daily_count_cap > 0);

comment on column public.hub_achievements.unique_meta_field is
  'When set, repeatable awards are unique per user + meta->>field value.';
comment on column public.hub_achievements.daily_count_cap is
  'Max awards of this key per America/New_York calendar day (null = unlimited).';

-- ---------------------------------------------------------------------------
-- For You clean streak
-- ---------------------------------------------------------------------------

create table if not exists public.hub_foryou_streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_clean_day date,
  updated_at timestamptz not null default now()
);

alter table public.hub_foryou_streaks enable row level security;

drop policy if exists "hub_foryou_streaks read own or admin" on public.hub_foryou_streaks;
create policy "hub_foryou_streaks read own or admin"
  on public.hub_foryou_streaks for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "hub_foryou_streaks admin write" on public.hub_foryou_streaks;
create policy "hub_foryou_streaks admin write"
  on public.hub_foryou_streaks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.hub_foryou_streaks to authenticated;

-- Packet "queued to assignee" timestamp (defaults to created_at for existing rows)
alter table public.event_packets
  add column if not exists queued_at timestamptz;

update public.event_packets
set queued_at = coalesce(queued_at, created_at)
where queued_at is null;

alter table public.event_packets
  alter column queued_at set default now();

-- ---------------------------------------------------------------------------
-- Seed earning-rule achievements
-- ---------------------------------------------------------------------------

insert into public.hub_achievements
  (key, title, description, points, difficulty, category, repeatable,
   unique_meta_field, daily_count_cap, sort_order)
values
  -- A. Event-triggered
  ('handbook_signed', 'Handbook signed',
   'Complete and sign the Staff Handbook', 50, 'medium', 'learn', false,
   null, null, 800),
  ('course_completed', 'Course completed',
   'Finish a Training Portal course', 50, 'medium', 'learn', true,
   'course_id', null, 810),
  ('action_created', 'Action created',
   'Add an Action Center item', 10, 'easy', 'field', true,
   null, 5, 820),
  ('action_completed', 'Action completed',
   'Complete an Action Center item assigned to you', 30, 'medium', 'field', true,
   'action_id', null, 830),
  ('announcement_ack', 'Announcement acknowledged',
   'Acknowledge a required announcement', 10, 'easy', 'social', true,
   'announcement_id', null, 840),
  ('todo_completed', 'To-do done',
   'Complete a personal My Week to-do', 5, 'easy', 'daily', true,
   'task_id', 10, 850),
  ('ask_hub_question', 'Asked the Hub',
   'Ask a question in Ask the Hub', 25, 'medium', 'learn', true,
   null, 3, 860),
  ('eoe_report_submitted', 'EOE report submitted',
   'Submit an End of Event Report', 40, 'medium', 'field', true,
   'report_id', null, 870),
  ('manual_event_photos', 'Event photos submitted',
   'Submit event photos via Submit Event Photos', 25, 'medium', 'field', true,
   'event_key', null, 880),
  ('packet_24h', 'Packet in 24 hours',
   'Complete an Event Packet within 24 hours of assignment', 75, 'hard', 'field', true,
   'packet_id', null, 890),

  -- B. Resources video
  ('resource_video_watched', 'Resource video played',
   'Open and play a video resource in the Hub', 10, 'easy', 'learn', true,
   'resource_id', null, 900),

  -- C. Chat sliding scale (per NY day / week via unique meta)
  ('chat_active_daily', 'Chat check-in',
   'Send your first real Chat message of the day', 5, 'easy', 'social', true,
   'day', null, 910),
  ('chat_active_5', 'Chat warming up',
   'Send 5 Chat messages in a day', 5, 'easy', 'social', true,
   'day', null, 920),
  ('chat_active_15', 'Chat active',
   'Send 15 Chat messages in a day (daily chat cap reached)', 10, 'easy', 'social', true,
   'day', null, 930),
  ('chat_active_week', 'Chat week',
   'Be active in Chat on 5 distinct days in a Mon–Sun week', 25, 'medium', 'social', true,
   'week', null, 940),

  -- D. For You clean streak milestones (one-time)
  ('foryou_clean_3', 'For You clean · 3',
   'Keep For You empty 3 days in a row', 150, 'hard', 'daily', false,
   null, null, 950),
  ('foryou_clean_7', 'For You clean · 7',
   'Keep For You empty 7 days in a row', 250, 'hard', 'daily', false,
   null, null, 960),
  ('foryou_clean_10', 'For You clean · 10',
   'Keep For You empty 10 days in a row', 350, 'hard', 'daily', false,
   null, null, 970),
  ('foryou_clean_14', 'For You clean · 14',
   'Keep For You empty 14 days in a row', 500, 'hard', 'daily', false,
   null, null, 980),
  ('foryou_clean_30', 'For You clean · 30',
   'Keep For You empty 30 days in a row', 750, 'legendary', 'daily', false,
   null, null, 990)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  points = excluded.points,
  difficulty = excluded.difficulty,
  category = excluded.category,
  repeatable = excluded.repeatable,
  unique_meta_field = excluded.unique_meta_field,
  daily_count_cap = excluded.daily_count_cap,
  sort_order = excluded.sort_order,
  is_active = true;

-- ---------------------------------------------------------------------------
-- Core award helper (works for any target user)
-- ---------------------------------------------------------------------------

create or replace function public.award_hub_achievement_core(
  p_user_id uuid,
  p_key text,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  a public.hub_achievements%rowtype;
  v_already boolean := false;
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_entity text;
  v_day_count integer;
begin
  if p_user_id is null then
    return jsonb_build_object('awarded', false, 'message', 'Missing user');
  end if;

  select role into v_role from public.profiles where id = p_user_id;
  if v_role is null or v_role = 'guest' then
    return jsonb_build_object('awarded', false, 'message', 'Guests cannot earn points');
  end if;

  select * into a from public.hub_achievements
  where key = p_key and is_active = true;
  if not found then
    return jsonb_build_object('awarded', false, 'message', 'Unknown achievement');
  end if;

  -- One-time global unlock
  if not a.repeatable then
    select exists (
      select 1 from public.hub_user_achievements
      where user_id = p_user_id and achievement_id = a.id
    ) into v_already;
    if v_already then
      return jsonb_build_object(
        'awarded', false, 'points', 0, 'key', a.key, 'title', a.title,
        'message', 'Already unlocked'
      );
    end if;
  end if;

  -- Per-entity uniqueness via meta field
  if a.unique_meta_field is not null then
    v_entity := nullif(trim(v_meta ->> a.unique_meta_field), '');
    if v_entity is null then
      return jsonb_build_object(
        'awarded', false, 'points', 0, 'key', a.key, 'title', a.title,
        'message', 'Missing entity id'
      );
    end if;
    if exists (
      select 1 from public.hub_point_events e
      where e.user_id = p_user_id
        and e.achievement_id = a.id
        and e.meta ->> a.unique_meta_field = v_entity
    ) then
      return jsonb_build_object(
        'awarded', false, 'points', 0, 'key', a.key, 'title', a.title,
        'message', 'Already awarded for this item'
      );
    end if;
  end if;

  -- Legacy daily_login once-per-day (when unique_meta_field is unset)
  if a.repeatable and a.key = 'daily_login' and a.unique_meta_field is null then
    if exists (
      select 1 from public.hub_point_events e
      where e.user_id = p_user_id
        and e.achievement_id = a.id
        and (timezone('America/New_York', e.created_at))::date
          = (timezone('America/New_York', now()))::date
    ) then
      return jsonb_build_object(
        'awarded', false, 'points', 0, 'key', a.key, 'title', a.title,
        'message', 'Already checked in today'
      );
    end if;
  end if;

  -- Daily count cap (America/New_York)
  if a.daily_count_cap is not null then
    select count(*)::integer into v_day_count
    from public.hub_point_events e
    where e.user_id = p_user_id
      and e.achievement_id = a.id
      and (timezone('America/New_York', e.created_at))::date
        = (timezone('America/New_York', now()))::date;
    if v_day_count >= a.daily_count_cap then
      return jsonb_build_object(
        'awarded', false, 'points', 0, 'key', a.key, 'title', a.title,
        'message', 'Daily cap reached'
      );
    end if;
  end if;

  if not a.repeatable then
    insert into public.hub_user_achievements (user_id, achievement_id)
    values (p_user_id, a.id)
    on conflict do nothing;
  end if;

  insert into public.hub_point_events (user_id, achievement_id, points, reason, meta)
  values (p_user_id, a.id, a.points, a.title, v_meta);

  insert into public.hub_point_balances (user_id, points, updated_at)
  values (p_user_id, a.points, now())
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

-- Self award (signed-in user)
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
begin
  if v_uid is null then
    return jsonb_build_object('awarded', false, 'message', 'Not signed in');
  end if;
  return public.award_hub_achievement_core(v_uid, p_key, p_meta);
end;
$$;

grant execute on function public.award_hub_achievement(text, jsonb) to authenticated;

-- Award to a specific user (self, admin, or service_role — for cron / assignee)
create or replace function public.award_hub_achievement_to(
  p_user_id uuid,
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
  v_jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if v_jwt_role = 'service_role' then
    return public.award_hub_achievement_core(p_user_id, p_key, p_meta);
  end if;

  if v_uid is null then
    return jsonb_build_object('awarded', false, 'message', 'Not signed in');
  end if;

  if v_uid <> p_user_id and not public.is_admin() then
    return jsonb_build_object('awarded', false, 'message', 'Not allowed');
  end if;

  return public.award_hub_achievement_core(p_user_id, p_key, p_meta);
end;
$$;

grant execute on function public.award_hub_achievement_to(uuid, text, jsonb) to authenticated;
grant execute on function public.award_hub_achievement_to(uuid, text, jsonb) to service_role;
grant execute on function public.award_hub_achievement_core(uuid, text, jsonb) to service_role;
