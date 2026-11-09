-- End of Event Report: post-event forms submitted by staff

create table public.event_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  event_date date not null,
  client_name text not null default '',
  venue text not null default '',
  event_type text not null
    check (event_type in (
      'Wedding',
      'Corporate',
      'Birthday',
      'Anniversary',
      'School Dance',
      'Other'
    )),
  hours_worked text not null default '',
  equipment_notes text not null default '',
  issues text not null default '',
  client_feedback text not null default '',
  rating integer not null
    check (rating >= 1 and rating <= 5),
  follow_up_needed boolean not null default false,
  follow_up_notes text not null default '',
  created_at timestamptz not null default now()
);

create index event_reports_reporter_id_idx on public.event_reports (reporter_id);
create index event_reports_event_date_idx on public.event_reports (event_date desc);
create index event_reports_created_at_idx on public.event_reports (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.event_reports enable row level security;

-- Staff can read their own reports; admins and trainers can read all
create policy "Users can read own or all if trainer/admin"
on public.event_reports
for select
to authenticated
using (
  reporter_id = auth.uid()
  or public.current_user_role() in ('admin', 'trainer')
);

-- Any signed-in user can insert a report as themselves
create policy "Users can insert own reports"
on public.event_reports
for insert
to authenticated
with check (reporter_id = auth.uid());

-- Author or admin can update
create policy "Authors and admins can update reports"
on public.event_reports
for update
to authenticated
using (
  reporter_id = auth.uid()
  or public.is_admin()
)
with check (
  reporter_id = auth.uid()
  or public.is_admin()
);

-- Author or admin can delete
create policy "Authors and admins can delete reports"
on public.event_reports
for delete
to authenticated
using (
  reporter_id = auth.uid()
  or public.is_admin()
);
