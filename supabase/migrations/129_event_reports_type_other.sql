-- End of Event Reports: optional detail when event_type is Other
-- (same pattern as event_packets.event_type_other). Display uses the
-- description alone — never "Other — …".

alter table public.event_reports
  add column if not exists event_type_other text not null default '';

comment on column public.event_reports.event_type_other is
  'Free-text description when event_type is Other. Shown as the event type label.';
