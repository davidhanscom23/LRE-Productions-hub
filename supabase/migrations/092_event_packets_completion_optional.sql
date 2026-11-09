-- Archive / optional Event Packets (e.g. created from website review backfill).
-- These stay available for DJs to fill if they want, but must not count as
-- overdue, appear on For You, or earn packet_24h pressure/points.

alter table public.event_packets
  add column if not exists completion_optional boolean not null default false;

comment on column public.event_packets.completion_optional is
  'When true, packet is optional archive work: never overdue, excluded from For You and packet_24h.';

create index if not exists event_packets_completion_optional_idx
  on public.event_packets (completion_optional)
  where completion_optional = true;

-- Backfill packets linked to website reviews that were created by the Aug 2026
-- review→packet bridge (and any incomplete review-linked packets older than the
-- normal 21-day auto-sync window).
update public.event_packets ep
set completion_optional = true
where ep.completion_optional = false
  and ep.status is distinct from 'completed'
  and ep.calendar_uid is not null
  and exists (
    select 1
    from public.event_external_reviews r
    where r.calendar_uid is not null
      and r.calendar_uid = ep.calendar_uid
  )
  and (
    ep.created_at >= timestamptz '2026-08-07 00:00:00+00'
    or ep.event_date < (current_date - 21)
  );
