-- Vident uses HoneyBook→Google iCal only. Clear leftover Y Entertainment
-- DJEP calendar URLs and any Event Packets / Hub assignments synced from them.

-- Personal DJEP Calendar Links (Y Entertainment staff feeds).
-- Profile edit triggers require an admin auth.uid(); migrations run as
-- postgres with no JWT, so briefly disable user triggers for this wipe.
alter table public.profiles disable trigger user;

update public.profiles
set djep_ical_url = null
where djep_ical_url is not null;

alter table public.profiles enable trigger user;

-- Drop legacy company_ical_url when it is a DJEP / Y Ent host, or when it
-- diverges from the HoneyBook URL (HoneyBook save used to mirror both keys;
-- an old Y Ent company URL can still sit beside a Vident HoneyBook URL).
delete from public.app_settings as company
where company.key = 'company_ical_url'
  and (
    company.value ilike '%youreventplanningsite%'
    or company.value ilike '%djeventplanner%'
    or company.value ilike '%yentertainment%'
    or exists (
      select 1
      from public.app_settings as hb
      where hb.key = 'honeybook_ical_url'
        and nullif(btrim(hb.value), '') is not null
        and nullif(btrim(company.value), '')
          is distinct from nullif(btrim(hb.value), '')
    )
  );

-- Keep the mirrored company key in sync with HoneyBook when present.
insert into public.app_settings (key, value, updated_at)
select
  'company_ical_url',
  btrim(hb.value),
  now()
from public.app_settings as hb
where hb.key = 'honeybook_ical_url'
  and nullif(btrim(hb.value), '') is not null
on conflict (key) do update
set
  value = excluded.value,
  updated_at = excluded.updated_at;

-- Packets created from DJEP EVENTID UIDs / youreventplanningsite hosts.
delete from public.event_packets
where calendar_uid ~* 'EVENTID:\d+'
   or calendar_uid ~* '@youreventplanningsite\.com';

-- Hub assignee rows keyed to those same DJEP event UIDs.
delete from public.calendar_event_assignments
where event_uid ~* 'EVENTID:\d+'
   or event_uid ~* '@youreventplanningsite\.com';
