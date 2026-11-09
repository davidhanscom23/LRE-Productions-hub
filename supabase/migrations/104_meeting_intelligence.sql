-- 098 Meeting Intelligence. Paste a meeting transcript; the hub's OpenAI model
-- produces a summary, a quality score, and action items with owners + due dates.
-- Distinct from the PLAUD recording sync. Admin + trainer (management tool).

create table if not exists public.meeting_notes (
  id             uuid primary key default gen_random_uuid(),
  title          text not null default '',
  meeting_date   date,
  transcript     text not null default '',
  summary        text not null default '',
  quality_score  int,
  analysis       jsonb not null default '{}'::jsonb,
  analyzed_at    timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint meeting_notes_title_not_blank check (char_length(trim(title)) > 0),
  constraint meeting_notes_score_range
    check (quality_score is null or (quality_score between 0 and 100))
);

create index if not exists meeting_notes_date_idx
  on public.meeting_notes (meeting_date desc nulls last);

create table if not exists public.meeting_action_items (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meeting_notes(id) on delete cascade,
  text       text not null default '',
  owner      text not null default '',
  due_date   date,
  status     text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now(),
  constraint meeting_action_items_text_not_blank check (char_length(trim(text)) > 0)
);

create index if not exists meeting_action_items_meeting_idx
  on public.meeting_action_items (meeting_id);
create index if not exists meeting_action_items_status_idx
  on public.meeting_action_items (status, due_date);

alter table public.meeting_notes enable row level security;
alter table public.meeting_action_items enable row level security;

-- Admin + trainer (management) may read and write.
drop policy if exists "meeting_notes manage" on public.meeting_notes;
create policy "meeting_notes manage"
  on public.meeting_notes for all to authenticated
  using (public.current_user_role() in ('admin','trainer'))
  with check (public.current_user_role() in ('admin','trainer'));

drop policy if exists "meeting_action_items manage" on public.meeting_action_items;
create policy "meeting_action_items manage"
  on public.meeting_action_items for all to authenticated
  using (public.current_user_role() in ('admin','trainer'))
  with check (public.current_user_role() in ('admin','trainer'));

grant select, insert, update, delete on public.meeting_notes to authenticated;
grant select, insert, update, delete on public.meeting_action_items to authenticated;

create or replace function public.set_meeting_notes_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists meeting_notes_updated_at on public.meeting_notes;
create trigger meeting_notes_updated_at
  before update on public.meeting_notes
  for each row execute function public.set_meeting_notes_updated_at();
