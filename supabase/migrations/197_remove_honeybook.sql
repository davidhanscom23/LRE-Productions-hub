-- 197 Remove HoneyBook.
-- The Hub no longer has any HoneyBook connection (Gmail sync, Zapier webhook, CSV import,
-- archive import, Zapier tasks), and the built-in CRM is now called Pipeline.
-- This migration (a) drops the tables only those connections used and (b) renames every
-- remaining HoneyBook-named table, column, index, constraint, policy, function and storage
-- bucket to Pipeline. Safe to run more than once, and a no-op on a database built from the
-- already-renamed earlier migrations.

do $$
declare
  r record;
  def text;
  new_name text;
begin
  -- 1. Tables that only the removed connections used (either spelling).
  for r in
    select unnest(array[
      'gmail_messages', 'gmail_threads', 'gmail_not_leads', 'gmail_sync_state',
      'webhook_events', 'archive_documents', 'tasks'
    ]) as suffix
  loop
    execute format('drop table if exists public.%I cascade', 'honeybook_' || r.suffix);
    execute format('drop table if exists public.%I cascade', 'pipeline_' || r.suffix);
  end loop;

  -- 2. Tables.
  for r in
    select tablename from pg_tables
    where schemaname = 'public' and tablename like 'honeybook\_%'
  loop
    new_name := replace(r.tablename, 'honeybook', 'pipeline');
    if to_regclass('public.' || quote_ident(new_name)) is null then
      execute format('alter table public.%I rename to %I', r.tablename, new_name);
    end if;
  end loop;

  -- 3. Columns on other tables (e.g. proposals.honeybook_project_id).
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join pg_tables t on t.schemaname = c.table_schema and t.tablename = c.table_name
    where c.table_schema = 'public' and c.column_name like '%honeybook%'
  loop
    new_name := replace(r.column_name, 'honeybook', 'pipeline');
    execute format('alter table public.%I rename column %I to %I', r.table_name, r.column_name, new_name);
  end loop;

  -- 4. Constraints, then indexes (a constraint's index is renamed with it).
  for r in
    select c.conname, rel.relname
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and c.conname like '%honeybook%'
  loop
    execute format('alter table public.%I rename constraint %I to %I',
      r.relname, r.conname, replace(r.conname, 'honeybook', 'pipeline'));
  end loop;
  for r in
    select indexname from pg_indexes
    where schemaname = 'public' and indexname like '%honeybook%'
  loop
    execute format('alter index public.%I rename to %I', r.indexname, replace(r.indexname, 'honeybook', 'pipeline'));
  end loop;

  -- 5. Policies and triggers.
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and policyname like '%honeybook%'
  loop
    execute format('alter policy %I on public.%I rename to %I',
      r.policyname, r.tablename, replace(r.policyname, 'honeybook', 'pipeline'));
  end loop;
  for r in
    select t.tgname, c.relname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal and t.tgname like '%honeybook%'
  loop
    execute format('alter trigger %I on public.%I rename to %I',
      r.tgname, r.relname, replace(r.tgname, 'honeybook', 'pipeline'));
  end loop;

  -- 6. Functions: rename the ones named for HoneyBook, then rewrite every body that mentions it.
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proname like '%honeybook%'
  loop
    execute format('alter function public.%I(%s) rename to %I',
      r.proname, r.args, replace(r.proname, 'honeybook', 'pipeline'));
  end loop;
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosrc ilike '%honeybook%'
  loop
    def := pg_get_functiondef(r.oid);
    def := replace(replace(replace(replace(def, 'HoneyBook', 'Pipeline'), 'Honeybook', 'Pipeline'), 'HONEYBOOK', 'PIPELINE'), 'honeybook', 'pipeline');
    execute def;
  end loop;
end $$;

-- 7. Storage: make sure the new project-files bucket exists. Supabase blocks deleting or renaming
--    buckets from SQL, so the two old (empty) HoneyBook buckets are removed by hand in the
--    dashboard: Storage > honeybook-project-files / honeybook-archive > Delete bucket.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit)
  values ('pipeline-project-files', 'pipeline-project-files', false, 52428800)
  on conflict (id) do nothing;
exception when others then
  raise notice 'Could not create bucket pipeline-project-files from SQL (%). Create it in the dashboard: private, 50 MB limit.', sqlerrm;
end $$;

-- 7b. Merge / undo-merge functions: recreated without the removed Gmail and task tables.
create or replace function public.merge_pipeline_projects(
  p_keep   uuid,
  p_merge  uuid,
  p_fields text[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text := public.current_user_role();
  v_keep         public.pipeline_projects%rowtype;
  v_merge        public.pipeline_projects%rowtype;
  v_actor_name   text;
  v_keep_lead    boolean;
  v_fields       text[];
  v_notes        jsonb;
  v_files        jsonb;
    v_payments     jsonb;
  v_proposals    jsonb;
  v_packets      jsonb;
      v_requests     jsonb;
  v_assignees    jsonb;
  v_questionnaire boolean := false;
  v_note_id      uuid;
  v_log_id       uuid;
begin
  if v_role not in ('admin', 'trainer') then
    raise exception 'Only admins and Leads can merge cards.';
  end if;
  if p_keep is null or p_merge is null or p_keep = p_merge then
    raise exception 'Pick two different cards to merge.';
  end if;

  select * into v_keep from public.pipeline_projects where id = p_keep for update;
  select * into v_merge from public.pipeline_projects where id = p_merge for update;
  if v_keep.id is null or v_merge.id is null then
    raise exception 'One of the cards no longer exists.';
  end if;
  if v_keep.merged_into is not null or v_merge.merged_into is not null then
    raise exception 'One of these cards was already merged into another.';
  end if;

  select coalesce(full_name, '') into v_actor_name from public.profiles where id = v_actor;

  -- Only these columns can be copied across.
  select coalesce(array_agg(f), '{}') into v_fields
  from unnest(coalesce(p_fields, '{}')) f
  where f in ('name', 'project_type', 'project_date', 'budget', 'location', 'details', 'client_id');

  -- Copy the chosen fields from the merged card onto the kept card.
  update public.pipeline_projects k set
    name         = case when 'name'         = any(v_fields) then v_merge.name         else k.name         end,
    project_type = case when 'project_type' = any(v_fields) then v_merge.project_type else k.project_type end,
    project_date = case when 'project_date' = any(v_fields) then v_merge.project_date else k.project_date end,
    budget       = case when 'budget'       = any(v_fields) then v_merge.budget       else k.budget       end,
    location     = case when 'location'     = any(v_fields) then v_merge.location     else k.location     end,
    details      = case when 'details'      = any(v_fields) then v_merge.details      else k.details      end,
    client_id    = case when 'client_id'    = any(v_fields) then v_merge.client_id    else k.client_id    end,
    updated_at   = now()
  where k.id = p_keep;

  -- Notes (the running trail)
  with moved as (
    update public.pipeline_project_notes set project_id = p_keep
    where project_id = p_merge returning id
  ) select coalesce(jsonb_agg(id), '[]'::jsonb) into v_notes from moved;

  -- Client uploads
  with moved as (
    update public.pipeline_project_files set project_id = p_keep
    where project_id = p_merge returning id
  ) select coalesce(jsonb_agg(id), '[]'::jsonb) into v_files from moved;

  -- Payments
  with moved as (
    update public.pipeline_payments set project_id = p_keep
    where project_id = p_merge returning id
  ) select coalesce(jsonb_agg(id), '[]'::jsonb) into v_payments from moved;

  -- Proposals and event packets that point at the card
  with moved as (
    update public.proposals set pipeline_project_id = p_keep
    where pipeline_project_id = p_merge returning id
  ) select coalesce(jsonb_agg(id), '[]'::jsonb) into v_proposals from moved;

  with moved as (
    update public.event_packets set pipeline_project_id = p_keep
    where pipeline_project_id = p_merge returning id
  ) select coalesce(jsonb_agg(id), '[]'::jsonb) into v_packets from moved;

  -- Staff add / remove requests that are still open (skip ones that would clash)
  with moved as (
    update public.pipeline_assignment_requests r set project_id = p_keep
    where r.project_id = p_merge
      and not exists (
        select 1 from public.pipeline_assignment_requests x
        where x.project_id = p_keep and x.target_profile_id = r.target_profile_id
          and x.action = r.action and x.status = 'pending' and r.status = 'pending'
      )
    returning r.id
  ) select coalesce(jsonb_agg(id), '[]'::jsonb) into v_requests from moved;

  -- Questionnaire: move it only when the kept card has none
  if not exists (select 1 from public.pipeline_project_questionnaire_answers where project_id = p_keep)
     and exists (select 1 from public.pipeline_project_questionnaire_answers where project_id = p_merge) then
    update public.pipeline_project_questionnaire_answers set project_id = p_keep where project_id = p_merge;
    v_questionnaire := true;
  end if;

  -- Assignees: add anyone not already on the kept card. The kept card's Lead stays Lead.
  select exists (
    select 1 from public.pipeline_project_assignees where project_id = p_keep and role = 'lead'
  ) into v_keep_lead;

  with ins as (
    insert into public.pipeline_project_assignees (project_id, profile_id, role, assigned_by)
    select p_keep, a.profile_id,
           case when a.role = 'lead' and not v_keep_lead then 'lead' else 'support' end,
           a.assigned_by
    from public.pipeline_project_assignees a
    where a.project_id = p_merge
      and not exists (
        select 1 from public.pipeline_project_assignees k
        where k.project_id = p_keep and k.profile_id = a.profile_id
      )
    returning profile_id
  ) select coalesce(jsonb_agg(profile_id), '[]'::jsonb) into v_assignees from ins;

  -- A visible line in the trail of the kept card
  insert into public.pipeline_project_notes (project_id, author_id, source, category, body, occurred_at)
  values (
    p_keep, v_actor, 'system', 'change',
    'Merged the duplicate card "' || v_merge.name || '" into this one'
      || case when v_actor_name <> '' then ' (by ' || v_actor_name || ')' else '' end
      || '. Its notes, files, payments and staff were moved here; the old card is archived.',
    now()
  ) returning id into v_note_id;

  -- Archive the merged card (kept so the merge can be undone)
  update public.pipeline_projects set
    stage = 'Archived',
    merged_into = p_keep,
    merged_at = now(),
    merged_by = v_actor,
    share_enabled = false,
    updated_at = now()
  where id = p_merge;

  insert into public.pipeline_project_stage_events (project_id, from_stage, to_stage, changed_by)
  values (p_merge, v_merge.stage, 'Archived', v_actor);

  insert into public.pipeline_project_merges (
    kept_id, merged_id, merged_by, fields_taken, kept_before, merged_before, moved
  ) values (
    p_keep, p_merge, v_actor, v_fields,
    jsonb_build_object(
      'name', v_keep.name, 'project_type', v_keep.project_type, 'project_date', v_keep.project_date,
      'budget', v_keep.budget, 'location', v_keep.location, 'details', v_keep.details,
      'client_id', v_keep.client_id
    ),
    jsonb_build_object('stage', v_merge.stage, 'name', v_merge.name, 'share_enabled', v_merge.share_enabled),
    jsonb_build_object(
      'notes', v_notes, 'files', v_files, 'payments', v_payments,
      'proposals', v_proposals, 'packets', v_packets, 'assignment_requests', v_requests,
      'assignees_added', v_assignees, 'questionnaire', v_questionnaire,
      'system_note', v_note_id
    )
  ) returning id into v_log_id;

  return v_log_id;
end;
$$;

revoke all on function public.merge_pipeline_projects(uuid, uuid, text[]) from public;
grant execute on function public.merge_pipeline_projects(uuid, uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Undo (admins only)
-- ---------------------------------------------------------------------------
create or replace function public.undo_pipeline_merge(p_merged_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  uuid := auth.uid();
  v_log    public.pipeline_project_merges%rowtype;
  v_mv     jsonb;
  v_kept_name text;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admins can undo a merge.';
  end if;

  select * into v_log from public.pipeline_project_merges
  where merged_id = p_merged_id and undone_at is null
  order by merged_at desc limit 1;
  if v_log.id is null then
    raise exception 'No merge to undo for this card.';
  end if;
  v_mv := v_log.moved;

  update public.pipeline_project_notes set project_id = v_log.merged_id
    where id in (select (jsonb_array_elements_text(v_mv -> 'notes'))::uuid)
      and id is distinct from nullif(v_mv ->> 'system_note', '')::uuid;
  delete from public.pipeline_project_notes
    where id = nullif(v_mv ->> 'system_note', '')::uuid;

  update public.pipeline_project_files set project_id = v_log.merged_id
    where id in (select (jsonb_array_elements_text(v_mv -> 'files'))::uuid);

  update public.pipeline_payments set project_id = v_log.merged_id
    where id in (select (jsonb_array_elements_text(v_mv -> 'payments'))::uuid);

  update public.proposals set pipeline_project_id = v_log.merged_id
    where id in (select (jsonb_array_elements_text(v_mv -> 'proposals'))::uuid);

  update public.event_packets set pipeline_project_id = v_log.merged_id
    where id in (select (jsonb_array_elements_text(v_mv -> 'packets'))::uuid);

  update public.pipeline_assignment_requests set project_id = v_log.merged_id
    where id in (select (jsonb_array_elements_text(v_mv -> 'assignment_requests'))::uuid);

  if coalesce((v_mv ->> 'questionnaire')::boolean, false) then
    update public.pipeline_project_questionnaire_answers set project_id = v_log.merged_id
      where project_id = v_log.kept_id;
  end if;

  delete from public.pipeline_project_assignees
    where project_id = v_log.kept_id
      and profile_id in (select (jsonb_array_elements_text(v_mv -> 'assignees_added'))::uuid);

  -- Put the kept card's fields back the way they were
  update public.pipeline_projects set
    name         = coalesce(v_log.kept_before ->> 'name', name),
    project_type = coalesce(v_log.kept_before ->> 'project_type', project_type),
    project_date = nullif(v_log.kept_before ->> 'project_date', '')::date,
    budget       = nullif(v_log.kept_before ->> 'budget', '')::numeric,
    location     = coalesce(v_log.kept_before ->> 'location', location),
    details      = coalesce(v_log.kept_before ->> 'details', details),
    client_id    = nullif(v_log.kept_before ->> 'client_id', '')::uuid,
    updated_at   = now()
  where id = v_log.kept_id;

  -- Bring the merged card back
  update public.pipeline_projects set
    stage = coalesce(nullif(v_log.merged_before ->> 'stage', ''), 'Inquiry'),
    merged_into = null,
    merged_at = null,
    merged_by = null,
    share_enabled = coalesce((v_log.merged_before ->> 'share_enabled')::boolean, share_enabled),
    updated_at = now()
  where id = v_log.merged_id;

  insert into public.pipeline_project_stage_events (project_id, from_stage, to_stage, changed_by)
  values (
    v_log.merged_id, 'Archived',
    coalesce(nullif(v_log.merged_before ->> 'stage', ''), 'Inquiry'), v_actor
  );

  select name into v_kept_name from public.pipeline_projects where id = v_log.kept_id;
  insert into public.pipeline_project_notes (project_id, author_id, source, category, body, occurred_at)
  values (
    v_log.kept_id, v_actor, 'system', 'change',
    'Undid the merge of "' || coalesce(v_log.merged_before ->> 'name', 'a card') || '". It is a separate card again.',
    now()
  );

  update public.pipeline_project_merges
    set undone_at = now(), undone_by = v_actor
    where id = v_log.id;

  return v_log.kept_id;
end;
$$;

revoke all on function public.undo_pipeline_merge(uuid) from public;
grant execute on function public.undo_pipeline_merge(uuid) to authenticated;

-- 8. Saved data: settings key, pinned shortcuts, links, and the seeded pricing note.
update public.app_settings set key = 'work_ical_url' where key = 'honeybook_ical_url'
  and not exists (select 1 from public.app_settings where key = 'work_ical_url');
delete from public.app_settings where key = 'honeybook_ical_url';
update public.home_shortcuts set href = replace(href, '/honeybook', '/pipeline') where href like '/honeybook%';
update public.hub_notifications set href = replace(href, '/honeybook', '/pipeline') where href like '%/honeybook%';
update public.quote_pricing_notes
  set body = replace(replace(body, '(align with HoneyBook contract)', '(align with the signed contract)'),
                     'paste link into the HoneyBook project', 'paste link into the project')
  where body ilike '%honeybook%';
