-- Portal catalog mapping for convert; Show Control Hub remote sessions.

-- ---------------------------------------------------------------------------
-- Venue portal packages / add-ons → Hub catalog
-- ---------------------------------------------------------------------------

alter table public.venue_portal_packages
  add column if not exists av_product_id uuid
    references public.av_products (id) on delete set null,
  add column if not exists av_service_id uuid
    references public.av_services (id) on delete set null;

alter table public.venue_portal_addons
  add column if not exists av_product_id uuid
    references public.av_products (id) on delete set null,
  add column if not exists av_service_id uuid
    references public.av_services (id) on delete set null;

comment on column public.venue_portal_packages.av_product_id is
  'Optional Hub catalog product used when converting a venue request to a quote.';
comment on column public.venue_portal_packages.av_service_id is
  'Optional Hub catalog service used when converting (ignored if av_product_id is set).';
comment on column public.venue_portal_addons.av_product_id is
  'Optional Hub catalog product used when converting a venue request to a quote.';
comment on column public.venue_portal_addons.av_service_id is
  'Optional Hub catalog service used when converting (ignored if av_product_id is set).';

-- ---------------------------------------------------------------------------
-- AV Show Control — Hub-hosted phone / Stream Deck remote
-- ---------------------------------------------------------------------------

create table if not exists public.av_show_sessions (
  id              uuid primary key default gen_random_uuid(),
  pin             text not null,
  control_token   text not null unique,
  next_seq        bigint not null default 0,
  state           jsonb not null default '{}'::jsonb,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint av_show_sessions_pin_len check (char_length(pin) between 4 and 8)
);

create index if not exists av_show_sessions_pin_idx
  on public.av_show_sessions (pin);

create index if not exists av_show_sessions_expires_idx
  on public.av_show_sessions (expires_at);

create table if not exists public.av_show_commands (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.av_show_sessions(id) on delete cascade,
  seq          bigint not null,
  command      text not null,
  value        text not null default '',
  created_at   timestamptz not null default now(),
  constraint av_show_commands_session_seq unique (session_id, seq)
);

create index if not exists av_show_commands_poll_idx
  on public.av_show_commands (session_id, seq);

comment on table public.av_show_sessions is
  'Short-lived AV Show Control remote sessions (PIN + control token).';
comment on table public.av_show_commands is
  'Queued remote commands for a show session (polled by the control page).';

alter table public.av_show_sessions enable row level security;
alter table public.av_show_commands enable row level security;

-- Service role / API routes use the service client; staff policies for debugging.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'av_show_sessions'
      and policyname = 'av_show_sessions_staff_all'
  ) then
    create policy av_show_sessions_staff_all on public.av_show_sessions
      for all to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and (
              p.role = 'admin'
              or 'Audiovisual' = any (p.departments)
            )
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and (
              p.role = 'admin'
              or 'Audiovisual' = any (p.departments)
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'av_show_commands'
      and policyname = 'av_show_commands_staff_all'
  ) then
    create policy av_show_commands_staff_all on public.av_show_commands
      for all to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and (
              p.role = 'admin'
              or 'Audiovisual' = any (p.departments)
            )
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and (
              p.role = 'admin'
              or 'Audiovisual' = any (p.departments)
            )
        )
      );
  end if;
end $$;
