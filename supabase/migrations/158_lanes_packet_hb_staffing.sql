-- Wedding/Social + Staffing lane bridges:
-- 1) Event Packets ↔ Pipeline CRM project FK (Hub deep links)
-- 2) Leads (trainer) may mark/clear Staffing unavailable rows
-- 3) Seed Wedding & Social quoting pricing notes (defaults staff can edit)

-- ---------------------------------------------------------------------------
-- event_packets.pipeline_project_id
-- ---------------------------------------------------------------------------

alter table public.event_packets
  add column if not exists pipeline_project_id uuid
    references public.pipeline_projects (id) on delete set null;

create index if not exists event_packets_pipeline_project_idx
  on public.event_packets (pipeline_project_id)
  where pipeline_project_id is not null;

comment on column public.event_packets.pipeline_project_id is
  'Optional Hub CRM (Pipeline mirror) project linked to this packet for deep links.';

-- ---------------------------------------------------------------------------
-- Staffing: Leads (trainer) can insert/update Hub time-off like admins
-- ---------------------------------------------------------------------------

drop policy if exists "time_off insert own or admin" on public.time_off_requests;
create policy "time_off insert own or admin or trainer"
  on public.time_off_requests for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or public.current_user_role() = 'trainer'
  );

drop policy if exists "time_off update own pending or admin" on public.time_off_requests;
create policy "time_off update own pending or admin or trainer"
  on public.time_off_requests for update to authenticated
  using (
    (user_id = auth.uid() and status = 'pending')
    or public.is_admin()
    or public.current_user_role() = 'trainer'
  )
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or public.current_user_role() = 'trainer'
  );

-- ---------------------------------------------------------------------------
-- Wedding & Social quoting defaults (idempotent by title+department)
-- ---------------------------------------------------------------------------

insert into public.quote_pricing_notes (department, title, body, sort_order)
select v.department, v.title, v.body, v.sort_order
from (
  values
    (
      'Wedding & Social',
      'Ceremony & cocktail',
      E'• Confirm ceremony start, cocktail hour, and dinner/dance windows\n• Note indoor vs outdoor and weather backup\n• Include mic needs (officiant, vows, toasts) and playlist contact',
      10
    ),
    (
      'Wedding & Social',
      'Reception timeline',
      E'• Grand entrance, first dance, parent dances, cake, last song\n• Vendor meal / break windows for DJ or photo team\n• Quiet hours or venue cutoff — price overtime clearly',
      20
    ),
    (
      'Wedding & Social',
      'Deposit & terms reminder',
      E'• Deposit and final balance timing (align with the signed contract)\n• Overtime, travel, and lodging when applicable\n• Hub Proposal PDF → Drive; paste link into the project',
      30
    )
) as v(department, title, body, sort_order)
where not exists (
  select 1
  from public.quote_pricing_notes n
  where n.department = v.department
    and n.title = v.title
);
