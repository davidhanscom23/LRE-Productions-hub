-- Deduplicate HoneyBook clients that share the same email, then enforce
-- unique lower(email) even when external_id is set (stops Zap duplicate rows).

-- Prefer the oldest row as keeper; prefer non-null external_id when merging.
with ranked as (
  select
    id,
    lower(trim(email)) as em,
    external_id,
    created_at,
    row_number() over (
      partition by lower(trim(email))
      order by
        case when external_id is not null and char_length(trim(external_id)) > 0 then 0 else 1 end,
        created_at asc,
        id asc
    ) as rn
  from public.honeybook_clients
  where char_length(trim(email)) > 0
),
keepers as (
  select id, em from ranked where rn = 1
),
dupes as (
  select r.id as dupe_id, k.id as keep_id
  from ranked r
  join keepers k on k.em = r.em
  where r.rn > 1
)
update public.honeybook_projects p
set client_id = d.keep_id
from dupes d
where p.client_id = d.dupe_id;

with ranked as (
  select
    id,
    lower(trim(email)) as em,
    external_id,
    created_at,
    row_number() over (
      partition by lower(trim(email))
      order by
        case when external_id is not null and char_length(trim(external_id)) > 0 then 0 else 1 end,
        created_at asc,
        id asc
    ) as rn
  from public.honeybook_clients
  where char_length(trim(email)) > 0
),
keepers as (
  select id, em from ranked where rn = 1
),
dupes as (
  select r.id as dupe_id, k.id as keep_id
  from ranked r
  join keepers k on k.em = r.em
  where r.rn > 1
)
delete from public.honeybook_clients c
using dupes d
where c.id = d.dupe_id;

drop index if exists public.honeybook_clients_email_uidx;
create unique index if not exists honeybook_clients_email_uidx
  on public.honeybook_clients (lower(email))
  where char_length(trim(email)) > 0;
