-- 167 Inquiry Forms (LeadGate Hub Edition).
--
-- Multi-step public inquiry forms: admins build them at /inquiry-forms, visitors fill them at
-- /inquire/<slug> (also inside the website iframe embed). The server decides every verdict
-- (date availability, travel zone, fit score) and writes every row; website visitors never
-- touch these tables directly. All public reads and writes go through the /api/inquire/* route
-- handlers with the service role, so there are NO anon policies anywhere in this file (same
-- model as 134_venue_quote_portals.sql). Admins read and manage the tables through the
-- is_admin() policies below.
--
-- A finished inquiry becomes a HoneyBook board project at stage 'Inquiry' (source_event
-- 'web_form', client matched by email or created); unfinished ones stay in inquiry_submissions
-- only, so the board never fills up with half-filled forms. The What's New entry lives in
-- src/lib/changelog.ts (this hub has no changelog table).
--
-- Safe to run more than once (idempotent house style).

-- ---------------------------------------------------------------------------
-- Forms (draft definition + settings) and their published versions
-- ---------------------------------------------------------------------------

create table if not exists public.inquiry_forms (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null,
  name                 text not null,
  brand                text not null default '',
  status               text not null default 'draft',
  definition           jsonb not null,
  settings             jsonb not null default '{}'::jsonb,
  published_version_id uuid,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint inquiry_forms_slug_key unique (slug),
  constraint inquiry_forms_slug_check check (
    char_length(slug) between 3 and 60
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint inquiry_forms_status_check check (status in ('draft', 'live', 'paused', 'archived'))
);

comment on table public.inquiry_forms is
  'Inquiry Forms: one row per website form. definition/settings are the DRAFT; the public page serves published_version_id.';

-- Draft-save concurrency token: moves only when the draft is saved. updated_at also moves on
-- publish and status changes, which would turn the next save into a false "someone else saved"
-- conflict. Added with add column, the same way as in the Y? hub's copy of this schema (whose
-- first version had no such column), so both hubs run one schema.
alter table public.inquiry_forms
  add column if not exists draft_saved_at timestamptz not null default now();

comment on column public.inquiry_forms.draft_saved_at is
  'Inquiry Forms: when the draft was last saved (the editor''s concurrency token).';

-- An early build kept that token inside settings (key _draftSavedAt): carry it over, then drop
-- the key. On this hub both statements match nothing (kept so the two hubs share one schema).
update public.inquiry_forms
set draft_saved_at = (settings ->> '_draftSavedAt')::timestamptz
where settings ->> '_draftSavedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}';

update public.inquiry_forms
set settings = settings - '_draftSavedAt'
where settings ? '_draftSavedAt';

create table if not exists public.inquiry_form_versions (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.inquiry_forms (id) on delete cascade,
  version      integer not null,
  definition   jsonb not null,
  settings     jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles (id) on delete set null,
  constraint inquiry_form_versions_form_version_key unique (form_id, version),
  constraint inquiry_form_versions_version_check check (version >= 1)
);

comment on table public.inquiry_form_versions is
  'Inquiry Forms: immutable published snapshots. Submissions point at the version the visitor filled.';

-- forms.published_version_id -> versions(id). Added after both tables exist; guarded so a
-- second run does not fail on the existing constraint.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inquiry_forms_published_version_fk'
      and conrelid = 'public.inquiry_forms'::regclass
  ) then
    alter table public.inquiry_forms
      add constraint inquiry_forms_published_version_fk
      foreign key (published_version_id)
      references public.inquiry_form_versions (id)
      on delete set null;
  end if;
end;
$$;

create index if not exists inquiry_form_versions_form_idx
  on public.inquiry_form_versions (form_id, version desc);

-- ---------------------------------------------------------------------------
-- Business settings (singleton row id = 1)
-- ---------------------------------------------------------------------------

create table if not exists public.inquiry_settings (
  id         integer primary key default 1,
  business   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint inquiry_settings_singleton_check check (id = 1)
);

comment on table public.inquiry_settings is
  'Inquiry Forms: business settings (home base, travel zones, availability rule, spam limits). One row, id = 1. Empty business = code defaults.';

insert into public.inquiry_settings (id) values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Submissions: one visitor's run through a form
-- ---------------------------------------------------------------------------

create table if not exists public.inquiry_submissions (
  id                   uuid primary key default gen_random_uuid(),
  form_id              uuid not null references public.inquiry_forms (id) on delete cascade,
  version_id           uuid references public.inquiry_form_versions (id) on delete set null,
  stage                text not null default 'in_progress',
  current_step         integer not null default 0,
  total_steps          integer not null default 0,
  answers              jsonb not null default '{}'::jsonb,
  contact_name         text,
  contact_email        text,
  contact_phone        text,
  event_date           date,
  event_location       text,
  guest_count          integer,
  qualification        jsonb not null default '{}'::jsonb,
  score                integer,
  score_label          text,
  attribution          jsonb not null default '{}'::jsonb,
  ip_hash              text,
  user_agent           text,
  token_hash           text not null,
  crm_ref              jsonb not null default '{}'::jsonb,
  spam_reason          text,
  started_at           timestamptz not null default now(),
  last_activity_at     timestamptz not null default now(),
  completed_at         timestamptz,
  abandoned_at         timestamptz,
  abandon_notified_at  timestamptz,
  staff_notified_at    timestamptz,
  confirmation_sent_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint inquiry_submissions_stage_check check (
    stage in ('in_progress', 'completed', 'waitlisted', 'abandoned', 'spam')
  ),
  constraint inquiry_submissions_score_check check (score is null or score between 0 and 100),
  constraint inquiry_submissions_score_label_check check (
    score_label is null or score_label in ('high', 'medium', 'low')
  ),
  constraint inquiry_submissions_steps_check check (current_step >= 0 and total_steps >= 0)
);

comment on table public.inquiry_submissions is
  'Inquiry Forms: one row per visitor run. Raw answers + server verdicts live here; the HoneyBook project is created at completion (crm_ref links it).';

-- CRM write claim. Completion, the sweep re-drive and the staff "Add to HoneyBook" button each
-- claim the submission through inquiry_crm_claim (below) before creating a HoneyBook project, so
-- two of them can never create two projects for one inquiry. A failed write clears it again.
alter table public.inquiry_submissions
  add column if not exists crm_claimed_at timestamptz;

comment on column public.inquiry_submissions.crm_claimed_at is
  'Inquiry Forms: when a CRM write was claimed (null = free). Kept after a successful write.';

create index if not exists inquiry_submissions_form_created_idx
  on public.inquiry_submissions (form_id, created_at desc);
create index if not exists inquiry_submissions_stage_activity_idx
  on public.inquiry_submissions (stage, last_activity_at);
create index if not exists inquiry_submissions_email_idx
  on public.inquiry_submissions (lower(contact_email));
create index if not exists inquiry_submissions_event_date_idx
  on public.inquiry_submissions (event_date);

-- ---------------------------------------------------------------------------
-- Delivery log: every side effect (CRM write, staff alert, emails, stats) with its outcome
-- ---------------------------------------------------------------------------

create table if not exists public.inquiry_log (
  id            bigserial primary key,
  submission_id uuid references public.inquiry_submissions (id) on delete set null,
  kind          text not null,
  channel       text,
  recipient     text,
  status        text not null,
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  constraint inquiry_log_status_check check (status in ('sent', 'failed', 'skipped'))
);

comment on table public.inquiry_log is
  'Inquiry Forms: one row per side effect attempt (crm_record, staff_notify, staff_email, confirmation, abandon_alert, stats, spam, check_error). The sweep cron counts attempts here.';

create index if not exists inquiry_log_submission_idx
  on public.inquiry_log (submission_id);
create index if not exists inquiry_log_kind_status_idx
  on public.inquiry_log (kind, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Fixed-window counters (spam limits, view dedupe). Service role only, pruned by the sweep.
-- ---------------------------------------------------------------------------

create table if not exists public.inquiry_rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);

comment on table public.inquiry_rate_limits is
  'Inquiry Forms: fixed-window counters keyed by hashed IP / hashed email. No policies on purpose: service role only.';

create index if not exists inquiry_rate_limits_window_idx
  on public.inquiry_rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- Daily funnel counters per form (America/New_York days)
-- ---------------------------------------------------------------------------

create table if not exists public.inquiry_form_stats (
  form_id   uuid not null references public.inquiry_forms (id) on delete cascade,
  day       date not null,
  views     integer not null default 0,
  starts    integer not null default 0,
  completes integer not null default 0,
  primary key (form_id, day)
);

comment on table public.inquiry_form_stats is
  'Inquiry Forms: views / starts / completes per form per Eastern day (spam excluded).';

-- ---------------------------------------------------------------------------
-- Geocode cache (venue / city text -> lat, lng) so each place is looked up once
-- ---------------------------------------------------------------------------

create table if not exists public.inquiry_geocode_cache (
  query_key  text primary key,
  lat        double precision,
  lng        double precision,
  confidence text,
  display    text,
  created_at timestamptz not null default now()
);

comment on table public.inquiry_geocode_cache is
  'Inquiry Forms: geocoder results by normalized query. lat/lng null = the place was not found (re-checked after 7 days).';

-- ---------------------------------------------------------------------------
-- updated_at triggers (shared public.set_updated_at() from 001)
-- ---------------------------------------------------------------------------

drop trigger if exists inquiry_forms_set_updated_at on public.inquiry_forms;
create trigger inquiry_forms_set_updated_at
  before update on public.inquiry_forms
  for each row execute function public.set_updated_at();

drop trigger if exists inquiry_settings_set_updated_at on public.inquiry_settings;
create trigger inquiry_settings_set_updated_at
  before update on public.inquiry_settings
  for each row execute function public.set_updated_at();

drop trigger if exists inquiry_submissions_set_updated_at on public.inquiry_submissions;
create trigger inquiry_submissions_set_updated_at
  before update on public.inquiry_submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: admins only. No anon policies (public traffic uses the service role).
-- ---------------------------------------------------------------------------

alter table public.inquiry_forms enable row level security;
alter table public.inquiry_form_versions enable row level security;
alter table public.inquiry_settings enable row level security;
alter table public.inquiry_submissions enable row level security;
alter table public.inquiry_log enable row level security;
alter table public.inquiry_rate_limits enable row level security;
alter table public.inquiry_form_stats enable row level security;
alter table public.inquiry_geocode_cache enable row level security;

drop policy if exists "inquiry_forms admin all" on public.inquiry_forms;
create policy "inquiry_forms admin all" on public.inquiry_forms
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "inquiry_form_versions admin all" on public.inquiry_form_versions;
create policy "inquiry_form_versions admin all" on public.inquiry_form_versions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "inquiry_settings admin all" on public.inquiry_settings;
create policy "inquiry_settings admin all" on public.inquiry_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "inquiry_submissions admin all" on public.inquiry_submissions;
create policy "inquiry_submissions admin all" on public.inquiry_submissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "inquiry_log admin all" on public.inquiry_log;
create policy "inquiry_log admin all" on public.inquiry_log
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "inquiry_form_stats admin all" on public.inquiry_form_stats;
create policy "inquiry_form_stats admin all" on public.inquiry_form_stats
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "inquiry_geocode_cache admin all" on public.inquiry_geocode_cache;
create policy "inquiry_geocode_cache admin all" on public.inquiry_geocode_cache
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- inquiry_rate_limits: RLS on, no policies (service role only).

-- ---------------------------------------------------------------------------
-- Grants: explicit, so the tables work the same on hosted and local stacks.
-- anon gets nothing (RLS would block it anyway; this is defense in depth).
-- ---------------------------------------------------------------------------

revoke all on table public.inquiry_forms from anon;
revoke all on table public.inquiry_form_versions from anon;
revoke all on table public.inquiry_settings from anon;
revoke all on table public.inquiry_submissions from anon;
revoke all on table public.inquiry_log from anon;
revoke all on table public.inquiry_rate_limits from anon;
revoke all on table public.inquiry_form_stats from anon;
revoke all on table public.inquiry_geocode_cache from anon;

grant select, insert, update, delete on table public.inquiry_forms to authenticated;
grant select, insert, update, delete on table public.inquiry_form_versions to authenticated;
grant select, insert, update, delete on table public.inquiry_settings to authenticated;
grant select, insert, update, delete on table public.inquiry_submissions to authenticated;
grant select, insert, update, delete on table public.inquiry_log to authenticated;
grant select, insert, update, delete on table public.inquiry_form_stats to authenticated;
grant select, insert, update, delete on table public.inquiry_geocode_cache to authenticated;

grant select, insert, update, delete on table public.inquiry_forms to service_role;
grant select, insert, update, delete on table public.inquiry_form_versions to service_role;
grant select, insert, update, delete on table public.inquiry_settings to service_role;
grant select, insert, update, delete on table public.inquiry_submissions to service_role;
grant select, insert, update, delete on table public.inquiry_log to service_role;
grant select, insert, update, delete on table public.inquiry_rate_limits to service_role;
grant select, insert, update, delete on table public.inquiry_form_stats to service_role;
grant select, insert, update, delete on table public.inquiry_geocode_cache to service_role;

revoke all on sequence public.inquiry_log_id_seq from anon;
grant usage, select on sequence public.inquiry_log_id_seq to authenticated;
grant usage, select on sequence public.inquiry_log_id_seq to service_role;

-- ---------------------------------------------------------------------------
-- Functions (plain SQL, SECURITY INVOKER, called with the service role only)
-- ---------------------------------------------------------------------------

-- Count one hit in a fixed window and return the new count (upsert).
create or replace function public.inquiry_rate_hit(p_key text, p_window_start timestamptz)
returns integer
language sql
volatile
set search_path = public
as $$
  insert into public.inquiry_rate_limits as r (key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count;
$$;

-- Add one to a form's daily views, starts or completes (any other field name is ignored).
create or replace function public.inquiry_stat_bump(p_form uuid, p_day date, p_field text)
returns void
language sql
volatile
set search_path = public
as $$
  insert into public.inquiry_form_stats as s (form_id, day, views, starts, completes)
  select
    p_form,
    p_day,
    case when p_field = 'views' then 1 else 0 end,
    case when p_field = 'starts' then 1 else 0 end,
    case when p_field = 'completes' then 1 else 0 end
  where p_field in ('views', 'starts', 'completes')
  on conflict (form_id, day) do update set
    views = s.views + excluded.views,
    starts = s.starts + excluded.starts,
    completes = s.completes + excluded.completes;
$$;

-- Claim the CRM write of one submission, atomically. It succeeds only while the submission has no
-- complete CRM record (crm_ref empty, or a half-done write marked partial, whose retry reuses the
-- client) and nobody holds the claim. With p_stale_seconds set, a claim older than that is taken
-- over: its holder is gone (route handlers and server actions run for minutes at most).
-- Returns {"claimed_at": ..., "crm_ref": ...} of the claimed row, or null when it was not claimed.
create or replace function public.inquiry_crm_claim(p_id uuid, p_stale_seconds integer default null)
returns jsonb
language sql
volatile
set search_path = public
as $$
  update public.inquiry_submissions as s
  set crm_claimed_at = now()
  where s.id = p_id
    and (coalesce(s.crm_ref, '{}'::jsonb) = '{}'::jsonb or s.crm_ref ->> 'partial' = 'true')
    and (
      s.crm_claimed_at is null
      or (p_stale_seconds is not null and s.crm_claimed_at < now() - p_stale_seconds * interval '1 second')
    )
  returning jsonb_build_object('claimed_at', s.crm_claimed_at, 'crm_ref', s.crm_ref);
$$;

-- New functions are executable by PUBLIC (and by anon / authenticated through default
-- privileges) unless revoked BY NAME.
revoke all on function public.inquiry_rate_hit(text, timestamptz) from public, anon, authenticated;
revoke all on function public.inquiry_stat_bump(uuid, date, text) from public, anon, authenticated;
revoke all on function public.inquiry_crm_claim(uuid, integer) from public, anon, authenticated;
grant execute on function public.inquiry_rate_hit(text, timestamptz) to service_role;
grant execute on function public.inquiry_stat_bump(uuid, date, text) to service_role;
grant execute on function public.inquiry_crm_claim(uuid, integer) to service_role;

