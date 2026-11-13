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

-- 7. Storage: the project-files bucket moves to its new name; the archive bucket goes away.
do $$
declare
  b record;
begin
  select * into b from storage.buckets where id = 'honeybook-project-files';
  if found then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('pipeline-project-files', 'pipeline-project-files', b.public, b.file_size_limit, b.allowed_mime_types)
    on conflict (id) do nothing;
    update storage.objects set bucket_id = 'pipeline-project-files' where bucket_id = 'honeybook-project-files';
    delete from storage.buckets where id = 'honeybook-project-files';
  end if;
  delete from storage.objects where bucket_id in ('honeybook-archive', 'pipeline-archive');
  delete from storage.buckets where id in ('honeybook-archive', 'pipeline-archive');
end $$;

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
