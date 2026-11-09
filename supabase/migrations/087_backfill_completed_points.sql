-- One-time backfill: handbook signatures + fully completed courses.
-- Idempotent via award_hub_achievement_core uniqueness (safe to re-run).
-- Requires 077 achievements: handbook_signed, course_completed.

-- Replace core with optional reason (drop 3-arg overload from 077 first).
drop function if exists public.award_hub_achievement_core(uuid, text, jsonb);

create or replace function public.award_hub_achievement_core(
  p_user_id uuid,
  p_key text,
  p_meta jsonb default '{}'::jsonb,
  p_reason text default null
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
  v_reason text;
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

  v_reason := coalesce(nullif(trim(p_reason), ''), a.title);

  insert into public.hub_point_events (user_id, achievement_id, points, reason, meta)
  values (p_user_id, a.id, a.points, v_reason, v_meta);

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

grant execute on function public.award_hub_achievement_core(uuid, text, jsonb, text)
  to authenticated, service_role;

-- Friendly alias for migrations / admin backfills (targets a given user).
create or replace function public.award_hub_achievement_for_user(
  p_user_id uuid,
  p_key text,
  p_meta jsonb default '{}'::jsonb,
  p_reason text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.award_hub_achievement_core(p_user_id, p_key, p_meta, p_reason);
$$;

grant execute on function public.award_hub_achievement_for_user(uuid, text, jsonb, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Backfill handbook signatures
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_result jsonb;
  v_count integer := 0;
begin
  if not exists (
    select 1 from public.hub_achievements
    where key = 'handbook_signed' and is_active
  ) then
    raise notice 'Skipping handbook backfill — handbook_signed achievement missing (run 077 first).';
    return;
  end if;

  if to_regclass('public.handbook_acknowledgements') is null then
    raise notice 'Skipping handbook backfill — handbook_acknowledgements missing.';
    return;
  end if;

  for r in
    select distinct ha.user_id
    from public.handbook_acknowledgements ha
    join public.profiles p on p.id = ha.user_id
    where p.role is distinct from 'guest'
      and coalesce(p.is_active, true)
  loop
    v_result := public.award_hub_achievement_for_user(
      r.user_id,
      'handbook_signed',
      jsonb_build_object('backfill', true, 'source', 'handbook_acknowledgements'),
      'Backfill: signed Staff Handbook'
    );
    if coalesce((v_result->>'awarded')::boolean, false) then
      v_count := v_count + 1;
    end if;
  end loop;

  raise notice 'Handbook backfill awarded % new grants.', v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill fully completed courses (all lessons done)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_result jsonb;
  v_count integer := 0;
  v_title text;
begin
  if not exists (
    select 1 from public.hub_achievements
    where key = 'course_completed' and is_active
  ) then
    raise notice 'Skipping course backfill — course_completed achievement missing (run 077 first).';
    return;
  end if;

  if to_regclass('public.training_lesson_completions') is null
     or to_regclass('public.training_lessons') is null
     or to_regclass('public.training_courses') is null then
    raise notice 'Skipping course backfill — training tables missing.';
    return;
  end if;

  for r in
    with course_lesson_counts as (
      select
        c.id as course_id,
        c.title as course_title,
        c.slug as course_slug,
        count(l.id)::integer as lesson_count
      from public.training_courses c
      join public.training_lessons l on l.course_id = c.id
      group by c.id, c.title, c.slug
      having count(l.id) > 0
    ),
    user_course_done as (
      select
        tlc.user_id,
        clc.course_id,
        clc.course_title,
        clc.course_slug,
        clc.lesson_count,
        count(distinct tlc.lesson_id)::integer as completed_count
      from course_lesson_counts clc
      join public.training_lessons l on l.course_id = clc.course_id
      join public.training_lesson_completions tlc on tlc.lesson_id = l.id
      join public.profiles p on p.id = tlc.user_id
      where p.role is distinct from 'guest'
        and coalesce(p.is_active, true)
      group by tlc.user_id, clc.course_id, clc.course_title, clc.course_slug, clc.lesson_count
      having count(distinct tlc.lesson_id) >= clc.lesson_count
    )
    select user_id, course_id, course_title, course_slug
    from user_course_done
  loop
    v_title := coalesce(nullif(trim(r.course_title), ''), r.course_slug, 'course');
    v_result := public.award_hub_achievement_for_user(
      r.user_id,
      'course_completed',
      jsonb_build_object(
        'backfill', true,
        'source', 'training_lesson_completions',
        'course_id', r.course_id::text,
        'course_slug', r.course_slug
      ),
      'Backfill: completed ' || v_title
    );
    if coalesce((v_result->>'awarded')::boolean, false) then
      v_count := v_count + 1;
    end if;
  end loop;

  raise notice 'Course backfill awarded % new grants.', v_count;
end;
$$;
