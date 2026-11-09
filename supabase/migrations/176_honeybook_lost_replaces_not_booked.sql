-- HoneyBook board: the "Not Booked" stage is retired. Move every project in it to "Lost".
-- Safe to re-run (a second run finds nothing to change).
update public.honeybook_projects
set stage = 'Lost',
    updated_at = now()
where lower(btrim(regexp_replace(btrim(stage, '_ '), '[_ -]+', ' ', 'g'))) = 'not booked';
