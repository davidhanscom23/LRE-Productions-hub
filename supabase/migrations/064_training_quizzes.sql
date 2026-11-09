-- Training Portal quizzes: questions per lesson + secure server-side grading.
-- Learners never read correct_index via table SELECT; grading is SECURITY DEFINER.

create table if not exists public.training_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.training_lessons (id) on delete cascade,
  prompt text not null,
  choices jsonb not null,
  correct_index integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_questions_correct_index_nonneg check (correct_index >= 0),
  constraint training_questions_choices_array check (
    jsonb_typeof(choices) = 'array'
    and jsonb_array_length(choices) >= 2
  )
);

create index if not exists training_questions_lesson_sort_idx
  on public.training_questions (lesson_id, sort_order);

alter table public.training_questions enable row level security;

grant select, insert, update, delete on public.training_questions to authenticated;

-- Staff see questions for published courses; admin/trainer see all.
-- correct_index is still selected by managers in the app; learners omit it in SELECT lists.
drop policy if exists "Authenticated users can read training questions" on public.training_questions;
create policy "Authenticated users can read training questions"
on public.training_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.training_lessons l
    join public.training_courses c on c.id = l.course_id
    where l.id = lesson_id
      and (
        c.status = 'published'
        or public.current_user_role() in ('admin', 'trainer')
      )
  )
  and public.current_user_role()::text is distinct from 'guest'
);

drop policy if exists "Admins and trainers can insert training questions" on public.training_questions;
create policy "Admins and trainers can insert training questions"
on public.training_questions
for insert
to authenticated
with check (public.current_user_role() in ('admin', 'trainer'));

drop policy if exists "Admins and trainers can update training questions" on public.training_questions;
create policy "Admins and trainers can update training questions"
on public.training_questions
for update
to authenticated
using (public.current_user_role() in ('admin', 'trainer'))
with check (public.current_user_role() in ('admin', 'trainer'));

drop policy if exists "Admins can delete training questions" on public.training_questions;
create policy "Admins can delete training questions"
on public.training_questions
for delete
to authenticated
using (public.is_admin());

-- Guest deny (restrictive), matching 042 pattern.
do $$
begin
  if to_regclass('public.training_questions') is null then
    return;
  end if;
  execute 'drop policy if exists guests_denied_training_questions_select on public.training_questions';
  execute 'drop policy if exists guests_denied_training_questions_insert on public.training_questions';
  execute 'drop policy if exists guests_denied_training_questions_update on public.training_questions';
  execute 'drop policy if exists guests_denied_training_questions_delete on public.training_questions';
  execute $p$
    create policy guests_denied_training_questions_select
    on public.training_questions as restrictive for select to authenticated
    using (public.current_user_role()::text is distinct from 'guest')
  $p$;
  execute $p$
    create policy guests_denied_training_questions_insert
    on public.training_questions as restrictive for insert to authenticated
    with check (public.current_user_role()::text is distinct from 'guest')
  $p$;
  execute $p$
    create policy guests_denied_training_questions_update
    on public.training_questions as restrictive for update to authenticated
    using (public.current_user_role()::text is distinct from 'guest')
  $p$;
  execute $p$
    create policy guests_denied_training_questions_delete
    on public.training_questions as restrictive for delete to authenticated
    using (public.current_user_role()::text is distinct from 'guest')
  $p$;
end $$;

-- Grade answers server-side; upsert completion on pass (>= 70%).
create or replace function public.training_grade_lesson(
  p_lesson_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  q record;
  total int := 0;
  correct int := 0;
  chosen int;
  passed boolean;
begin
  if uid is null then
    return jsonb_build_object('error', 'unauthenticated');
  end if;
  if public.current_user_role()::text = 'guest' then
    return jsonb_build_object('error', 'guest');
  end if;

  -- Lesson must be visible (published course, or admin/trainer).
  if not exists (
    select 1
    from public.training_lessons l
    join public.training_courses c on c.id = l.course_id
    where l.id = p_lesson_id
      and (
        c.status = 'published'
        or public.current_user_role() in ('admin', 'trainer')
      )
  ) then
    return jsonb_build_object('error', 'not_found');
  end if;

  for q in
    select id, correct_index
    from public.training_questions
    where lesson_id = p_lesson_id
    order by sort_order, created_at
  loop
    total := total + 1;
    chosen := null;
    if p_answers is not null and p_answers ? q.id::text then
      begin
        chosen := (p_answers ->> q.id::text)::int;
      exception when others then
        chosen := null;
      end;
    end if;
    if chosen is not null and chosen = q.correct_index then
      correct := correct + 1;
    end if;
  end loop;

  if total = 0 then
    return jsonb_build_object('error', 'no_questions');
  end if;

  passed := (correct::numeric / total::numeric) >= 0.7;

  if passed then
    insert into public.training_lesson_completions (user_id, lesson_id, completed_at)
    values (uid, p_lesson_id, now())
    on conflict (user_id, lesson_id) do update
      set completed_at = excluded.completed_at;
  end if;

  return jsonb_build_object(
    'total', total,
    'correct', correct,
    'passed', passed
  );
end;
$$;

revoke all on function public.training_grade_lesson(uuid, jsonb) from public;
grant execute on function public.training_grade_lesson(uuid, jsonb) to authenticated;
