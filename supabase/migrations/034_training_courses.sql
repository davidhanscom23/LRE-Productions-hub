-- Training Portal thin course v1: courses, lessons, and per-user completions.

create table public.training_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  blurb text not null default '',
  audience text not null default 'All staff',
  status text not null default 'published'
    check (status in ('draft', 'published', 'coming_soon')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index training_courses_status_sort_idx
  on public.training_courses (status, sort_order, title);

create table public.training_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.training_courses (id) on delete cascade,
  sort_order integer not null default 0,
  title text not null,
  body text not null default '',
  resource_href text not null default '',
  resource_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index training_lessons_course_sort_idx
  on public.training_lessons (course_id, sort_order);

create table public.training_lesson_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.training_lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index training_lesson_completions_user_idx
  on public.training_lesson_completions (user_id);

create index training_lesson_completions_lesson_idx
  on public.training_lesson_completions (lesson_id);

alter table public.training_courses enable row level security;
alter table public.training_lessons enable row level security;
alter table public.training_lesson_completions enable row level security;

-- Catalog: staff see published + coming_soon; admin/trainer see all (incl. draft).
create policy "Authenticated users can read training courses"
on public.training_courses
for select
to authenticated
using (
  status in ('published', 'coming_soon')
  or public.current_user_role() in ('admin', 'trainer')
);

create policy "Admins and trainers can insert training courses"
on public.training_courses
for insert
to authenticated
with check (public.current_user_role() in ('admin', 'trainer'));

create policy "Admins and trainers can update training courses"
on public.training_courses
for update
to authenticated
using (public.current_user_role() in ('admin', 'trainer'))
with check (public.current_user_role() in ('admin', 'trainer'));

create policy "Admins can delete training courses"
on public.training_courses
for delete
to authenticated
using (public.is_admin());

-- Lessons follow course visibility (join via course status for staff).
create policy "Authenticated users can read training lessons"
on public.training_lessons
for select
to authenticated
using (
  exists (
    select 1
    from public.training_courses c
    where c.id = course_id
      and (
        c.status = 'published'
        or public.current_user_role() in ('admin', 'trainer')
      )
  )
);

create policy "Admins and trainers can insert training lessons"
on public.training_lessons
for insert
to authenticated
with check (public.current_user_role() in ('admin', 'trainer'));

create policy "Admins and trainers can update training lessons"
on public.training_lessons
for update
to authenticated
using (public.current_user_role() in ('admin', 'trainer'))
with check (public.current_user_role() in ('admin', 'trainer'));

create policy "Admins can delete training lessons"
on public.training_lessons
for delete
to authenticated
using (public.is_admin());

create policy "Users can read own training lesson completions"
on public.training_lesson_completions
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('admin', 'trainer')
);

create policy "Users can insert own training lesson completions"
on public.training_lesson_completions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own training lesson completions"
on public.training_lesson_completions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own training lesson completions"
on public.training_lesson_completions
for delete
to authenticated
using (user_id = auth.uid());

comment on table public.training_courses is
  'Self-paced Training Portal courses (thin LMS catalog).';
comment on table public.training_lessons is
  'Lessons for a training course. Body is plain text; optional Hub link.';
comment on table public.training_lesson_completions is
  'Per-user lesson completion for Training Portal progress.';

-- Seed catalog + New Hire Onboarding lessons (idempotent fixed ids).
insert into public.training_courses (
  id, slug, title, blurb, audience, status, sort_order
) values
  (
    'a1000000-0000-4000-8000-000000000001',
    'onboarding',
    'New Hire Onboarding',
    'Company culture, safety basics, and first-week Hub checklists.',
    'All staff',
    'published',
    10
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'dj-basics',
    'DJ Setup Essentials',
    'Gear check, room layout, and walk-in workflow.',
    'DJ',
    'coming_soon',
    20
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'client-planning',
    'Client Planning & DJEP',
    'Planning forms, music requests, and portal tips.',
    'DJ',
    'coming_soon',
    30
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'photobooth',
    'Photobooth Ops',
    'Booth setup, props, and guest flow.',
    'Photobooth',
    'coming_soon',
    40
  )
on conflict (slug) do nothing;

insert into public.training_lessons (
  id, course_id, sort_order, title, body, resource_href, resource_label
) values
  (
    'b1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    10,
    'Welcome to Y? Entertainment',
    E'Welcome to the team.\n\nY? Entertainment is built on show-up energy, clear communication, and taking care of every client like they are the only event that night.\n\nIn this short course you will learn where to find Hub tools, how first-week checklists work, and who to ask when you are stuck.\n\nTip: keep My Week and Teams open during your first events — that is where day-of links and department videos live.',
    '/my-week',
    'Open My Week'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    20,
    'Culture & how we show up',
    E'Our bar is simple:\n\n1. Be early enough to set up calmly.\n2. Look professional and stay guest-facing when clients or guests are nearby.\n3. Own problems — escalate early, do not hide issues.\n4. Leave the space better than you found it.\n\nIf something feels unclear at a venue, text your lead and document what happened in the Event Packet after the night.',
    '',
    ''
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000001',
    30,
    'Safety basics',
    E'Before every event:\n\n- Know fire exits and load-in paths.\n- Keep cables tidy; tape where guests walk.\n- Do not lift alone if gear is awkward or heavy — ask for a second person.\n- Never leave valuable gear unattended in an unlocked room or vehicle.\n\nIf anyone is hurt or a guest is unsafe, contact your lead immediately and follow venue staff direction.',
    '',
    ''
  ),
  (
    'b1000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000001',
    40,
    'Your first week in the Hub',
    E'Complete these Hub steps in week one:\n\n1. Confirm your People profile (phone + departments look right).\n2. Open Teams for your department and watch any pinned tutorial videos.\n3. Bookmark Event Packets — you will complete one after assigned events.\n4. Skim Resources for shared files and the Staff Handbook when it is published.\n5. Use Ask the Hub or Support Guide when you are not sure where a tool lives.\n\nAdmins may also assign onboarding form links on your People → Onboarding tab.',
    '/people',
    'Open People'
  ),
  (
    'b1000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000001',
    50,
    'Where to find help',
    E'When you need help, use this order:\n\n1. Support Guide — short Hub how-tos.\n2. Ask the Hub — free-form questions about Hub workflows.\n3. Your department lead / trainer — day-of and client questions.\n4. Office / admin — access, pay, or account issues.\n\nDepartment tutorial videos stay in Teams. This Training Portal is for self-paced written courses and progress.',
    '/support-guide',
    'Open Support Guide'
  ),
  (
    'b1000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-000000000001',
    60,
    'After events: packets & wrap-up',
    E'After an assigned event, open Event Packets the same night or next morning:\n\n- Fill the wrap-up fields (including a memorable moment).\n- Upload photos/videos with the suggested tags.\n- Mark the packet complete so marketing and archives stay current.\n\nIncomplete packets become overdue the day after the event — you will see reminders on My Week and in the top-bar bell.',
    '/event-packets',
    'Open Event Packets'
  )
on conflict (id) do nothing;
