-- Seed Y? Entertainment Pinterest boards (ids pulled from live Pinterest).
-- Default board for drafts without a pick: Real Life Weddings (148267081421621074).
-- Idempotent on board_id.

insert into public.pinterest_boards (label, board_id, sort_order)
values
  ('Real Life Weddings', '148267081421621074', 0),
  ('Saint Augustine Weddings', '148267081421621072', 1),
  ('Ponte Vedra Weddings', '148267081421621073', 2),
  ('Jacksonville Weddings', '148267081421621071', 3),
  ('Fun Wedding Ideas', '148267081421621070', 4)
on conflict (board_id) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order;
