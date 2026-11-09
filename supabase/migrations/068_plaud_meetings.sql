-- 068 Plaud Meetings: synced recordings from Plaud Cloud (company account).
-- Staff can read summaries/transcripts; only admins (or service role) write via sync.

create table if not exists public.plaud_meetings (
  id                   uuid primary key default gen_random_uuid(),
  plaud_file_id        text not null unique,
  title                text not null default 'Untitled recording',
  recorded_at          timestamptz,
  duration_ms          integer,
  summary_markdown     text not null default '',
  transcript_text      text not null default '',
  transcript_segments  jsonb not null default '[]'::jsonb,
  action_items         jsonb not null default '[]'::jsonb,
  has_summary          boolean not null default false,
  has_transcript       boolean not null default false,
  raw_metadata         jsonb,
  synced_at            timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint plaud_meetings_title_not_blank check (char_length(trim(title)) > 0)
);

create index if not exists plaud_meetings_recorded_idx
  on public.plaud_meetings (recorded_at desc nulls last);
create index if not exists plaud_meetings_synced_idx
  on public.plaud_meetings (synced_at desc);

alter table public.plaud_meetings enable row level security;

drop policy if exists "plaud_meetings read (authenticated non-guest)" on public.plaud_meetings;
create policy "plaud_meetings read (authenticated non-guest)"
  on public.plaud_meetings for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role is distinct from 'guest'
    )
  );

-- Writes go through service role (cron / admin sync). No authenticated insert/update/delete.

grant select on public.plaud_meetings to authenticated;

create or replace function public.set_plaud_meetings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plaud_meetings_updated_at on public.plaud_meetings;
create trigger plaud_meetings_updated_at
  before update on public.plaud_meetings
  for each row execute function public.set_plaud_meetings_updated_at();
