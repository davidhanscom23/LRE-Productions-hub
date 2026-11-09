-- Event gear checklists: one checklist per Hub project (event). Equipment comes from the linked
-- AV estimate when there is one, or is added by hand. Assigned staff check items OUT of and BACK
-- INTO the warehouse; every check is kept (who, when, how many, damaged/missing, photo).

-- ---------------------------------------------------------------------------
-- 1. Link an AV estimate to the Hub project (event) it belongs to
-- ---------------------------------------------------------------------------
alter table public.av_opportunities
  add column if not exists honeybook_project_id uuid
    references public.honeybook_projects (id) on delete set null;

create index if not exists av_opportunities_project_idx
  on public.av_opportunities (honeybook_project_id)
  where honeybook_project_id is not null;

comment on column public.av_opportunities.honeybook_project_id is
  'Hub project (event card) this estimate belongs to; supplies the gear list for its checklist.';

-- ---------------------------------------------------------------------------
-- 2. Last-used trace on every inventory product
-- ---------------------------------------------------------------------------
alter table public.av_products
  add column if not exists last_used_event text not null default '',
  add column if not exists last_used_by uuid references public.profiles (id) on delete set null,
  add column if not exists last_used_at timestamptz;

comment on column public.av_products.last_used_event is
  'Permanent trace: the last event this product went out to (never archived).';

-- ---------------------------------------------------------------------------
-- 3. Checklists, items, and the check log
-- ---------------------------------------------------------------------------
create table if not exists public.event_checklists (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.honeybook_projects (id) on delete cascade,
  opportunity_id      uuid references public.av_opportunities (id) on delete set null,
  -- Scheduled leave-the-warehouse and back-in-the-warehouse times (approximate is fine).
  depart_at           timestamptz,
  return_at           timestamptz,
  status              text not null default 'open' check (status in ('open', 'closed')),
  out_alert_sent_at   timestamptz,
  back_alert_sent_at  timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists event_checklists_project_uidx
  on public.event_checklists (project_id);
create index if not exists event_checklists_opportunity_idx
  on public.event_checklists (opportunity_id) where opportunity_id is not null;
create index if not exists event_checklists_times_idx
  on public.event_checklists (status, depart_at, return_at);

create table if not exists public.event_checklist_items (
  id             uuid primary key default gen_random_uuid(),
  checklist_id   uuid not null references public.event_checklists (id) on delete cascade,
  product_id     uuid references public.av_products (id) on delete set null,
  line_id        uuid references public.av_opportunity_lines (id) on delete set null,
  name           text not null check (char_length(btrim(name)) > 0),
  qty_needed     numeric(12, 2) not null default 1 check (qty_needed > 0),
  -- in_house = our gear; client_supplied / sub_rented never come back to our warehouse.
  source         text not null default 'in_house'
                   check (source in ('in_house', 'client_supplied', 'sub_rented')),
  -- false for things that are sold or used up: they only need the OUT check.
  returns        boolean not null default true,
  note           text not null default '',
  sort_order     integer not null default 0,
  origin         text not null default 'manual' check (origin in ('contract', 'manual')),
  -- Soft remove (contract dropped the line or staff removed it); checks are kept for history.
  removed_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists event_checklist_items_checklist_idx
  on public.event_checklist_items (checklist_id, sort_order);
create unique index if not exists event_checklist_items_line_uidx
  on public.event_checklist_items (checklist_id, line_id) where line_id is not null;
create index if not exists event_checklist_items_product_idx
  on public.event_checklist_items (product_id) where product_id is not null;

-- Append-only log. qty is the change in how many are checked for that pass (negative = undo,
-- zero = a damaged/missing flag or note with no count change).
create table if not exists public.event_checklist_checks (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.event_checklist_items (id) on delete cascade,
  checklist_id   uuid not null references public.event_checklists (id) on delete cascade,
  pass           text not null check (pass in ('out', 'back')),
  qty            numeric(12, 2) not null,
  flag           text not null default 'none' check (flag in ('none', 'damaged', 'missing')),
  note           text not null default '',
  photo_path     text,
  checked_by     uuid references public.profiles (id) on delete set null,
  checked_at     timestamptz not null default now(),
  -- Set by the device so a replayed offline queue never double-counts.
  client_id      text,
  -- Snapshot so history stays readable if the item, product or project changes later.
  item_name      text not null default '',
  product_id     uuid,
  project_id     uuid,
  project_name   text not null default '',
  event_date     date
);
create unique index if not exists event_checklist_checks_client_uidx
  on public.event_checklist_checks (client_id) where client_id is not null;
create index if not exists event_checklist_checks_item_idx
  on public.event_checklist_checks (item_id, pass);
create index if not exists event_checklist_checks_checklist_idx
  on public.event_checklist_checks (checklist_id, checked_at desc);
create index if not exists event_checklist_checks_product_idx
  on public.event_checklist_checks (product_id, checked_at desc) where product_id is not null;
create index if not exists event_checklist_checks_when_idx
  on public.event_checklist_checks (checked_at desc);

comment on table public.event_checklist_checks is
  'Append-only history of every gear check-out / check-back. Rows older than 90 days are archived yearly.';

-- ---------------------------------------------------------------------------
-- 4. Who may see and check a checklist: admins and Leads, plus staff assigned to the project
-- ---------------------------------------------------------------------------
create or replace function public.checklist_can_access(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_role()::text in ('admin', 'trainer')
    or exists (
      select 1 from public.honeybook_project_assignees a
      where a.project_id = p_project and a.profile_id = auth.uid()
    );
$$;

alter table public.event_checklists enable row level security;
alter table public.event_checklist_items enable row level security;
alter table public.event_checklist_checks enable row level security;

drop policy if exists "checklists read" on public.event_checklists;
create policy "checklists read" on public.event_checklists for select to authenticated
  using (public.checklist_can_access(project_id));
drop policy if exists "checklists write" on public.event_checklists;
create policy "checklists write" on public.event_checklists for all to authenticated
  using (public.checklist_can_access(project_id))
  with check (public.checklist_can_access(project_id));

drop policy if exists "checklist items read" on public.event_checklist_items;
create policy "checklist items read" on public.event_checklist_items for select to authenticated
  using (exists (
    select 1 from public.event_checklists c
    where c.id = checklist_id and public.checklist_can_access(c.project_id)
  ));
drop policy if exists "checklist items write" on public.event_checklist_items;
create policy "checklist items write" on public.event_checklist_items for all to authenticated
  using (exists (
    select 1 from public.event_checklists c
    where c.id = checklist_id and public.checklist_can_access(c.project_id)
  ))
  with check (exists (
    select 1 from public.event_checklists c
    where c.id = checklist_id and public.checklist_can_access(c.project_id)
  ));

-- Checks: read and insert only. No update or delete, so the history stays honest.
drop policy if exists "checklist checks read" on public.event_checklist_checks;
create policy "checklist checks read" on public.event_checklist_checks for select to authenticated
  using (exists (
    select 1 from public.event_checklists c
    where c.id = checklist_id and public.checklist_can_access(c.project_id)
  ));
drop policy if exists "checklist checks insert" on public.event_checklist_checks;
create policy "checklist checks insert" on public.event_checklist_checks for insert to authenticated
  with check (
    checked_by = auth.uid()
    and exists (
      select 1 from public.event_checklists c
      where c.id = checklist_id and public.checklist_can_access(c.project_id)
    )
  );

grant select, insert, update, delete on public.event_checklists to authenticated, service_role;
grant select, insert, update, delete on public.event_checklist_items to authenticated, service_role;
grant select, insert on public.event_checklist_checks to authenticated;
grant select, insert, update, delete on public.event_checklist_checks to service_role;

-- ---------------------------------------------------------------------------
-- 5. Progress view (per item and pass, summed from the log)
-- ---------------------------------------------------------------------------
create or replace view public.event_checklist_item_progress
with (security_invoker = true) as
select
  i.id as item_id,
  i.checklist_id,
  i.qty_needed,
  i.source,
  i.returns,
  i.removed_at,
  coalesce(sum(k.qty) filter (where k.pass = 'out'), 0)::numeric(12, 2) as qty_out,
  coalesce(sum(k.qty) filter (where k.pass = 'back'), 0)::numeric(12, 2) as qty_back
from public.event_checklist_items i
left join public.event_checklist_checks k on k.item_id = i.id
group by i.id;

grant select on public.event_checklist_item_progress to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Check log triggers: fill the snapshot, mirror AV gear to the Warehouse ledger,
--    and keep the permanent last-used trace on the product
-- ---------------------------------------------------------------------------
create or replace function public.event_checklist_check_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item   record;
  v_proj   record;
begin
  select i.name, i.product_id, c.project_id into v_item
  from public.event_checklist_items i
  join public.event_checklists c on c.id = i.checklist_id
  where i.id = new.item_id;

  select p.name, p.project_date into v_proj
  from public.honeybook_projects p where p.id = v_item.project_id;

  new.item_name    := coalesce(v_item.name, '');
  new.product_id   := v_item.product_id;
  new.project_id   := v_item.project_id;
  new.project_name := coalesce(v_proj.name, '');
  new.event_date   := v_proj.project_date;
  return new;
end;
$$;

drop trigger if exists event_checklist_checks_before_insert on public.event_checklist_checks;
create trigger event_checklist_checks_before_insert
  before insert on public.event_checklist_checks
  for each row execute function public.event_checklist_check_before_insert();

create or replace function public.event_checklist_check_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opp   uuid;
  v_dir   text;
begin
  select c.opportunity_id into v_opp
  from public.event_checklists c where c.id = new.checklist_id;

  -- Mirror to the AV Warehouse ledger so /rentals/warehouse stays accurate.
  if v_opp is not null and new.product_id is not null and new.qty <> 0 then
    v_dir := case
      when new.pass = 'out' and new.qty > 0 then 'out'
      when new.pass = 'out' and new.qty < 0 then 'back'
      when new.pass = 'back' and new.qty > 0 then 'back'
      else 'out'
    end;
    insert into public.av_gear_movements (opportunity_id, product_id, direction, qty, notes, created_by)
    values (v_opp, new.product_id, v_dir, abs(new.qty),
            'Checklist: ' || new.pass || case when new.qty < 0 then ' (undo)' else '' end,
            new.checked_by);
  end if;

  -- Permanent last-used trace.
  if new.pass = 'out' and new.qty > 0 and new.product_id is not null then
    update public.av_products
       set last_used_event = new.project_name,
           last_used_by    = new.checked_by,
           last_used_at    = new.checked_at
     where id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists event_checklist_checks_after_insert on public.event_checklist_checks;
create trigger event_checklist_checks_after_insert
  after insert on public.event_checklist_checks
  for each row execute function public.event_checklist_check_after_insert();

-- ---------------------------------------------------------------------------
-- 7. Contract sync: the checklist follows the estimate automatically
--    Services (crew, transport, fees) are not gear. A package header is skipped when it has
--    items nested under it. Tags and checked quantities are never touched by a sync.
-- ---------------------------------------------------------------------------
create or replace function public.event_checklist_sync(p_checklist uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opp uuid;
begin
  select opportunity_id into v_opp from public.event_checklists where id = p_checklist;
  if v_opp is null then
    return;
  end if;

  insert into public.event_checklist_items
    (checklist_id, product_id, line_id, name, qty_needed, returns, sort_order, origin, removed_at)
  select
    p_checklist,
    l.product_id,
    l.id,
    coalesce(nullif(btrim(l.description), ''), p.name, 'Item'),
    l.qty,
    case
      when p.kind in ('sale', 'consumable') then false
      when l.product_id is null and l.text_kind = 'sale' then false
      else true
    end,
    l.sort_order,
    'contract',
    null
  from public.av_opportunity_lines l
  left join public.av_products p on p.id = l.product_id
  where l.opportunity_id = v_opp
    and l.service_id is null
    and (l.product_id is not null or l.text_kind is not null)
    and not (
      coalesce(p.kind, '') = 'package'
      and exists (select 1 from public.av_opportunity_lines k where k.parent_line_id = l.id)
    )
  on conflict (checklist_id, line_id) where line_id is not null
  do update set
    name       = excluded.name,
    qty_needed = excluded.qty_needed,
    returns    = excluded.returns,
    sort_order = excluded.sort_order,
    removed_at = null,
    updated_at = now();

  -- Lines that left the estimate are marked removed (their checks stay in history).
  update public.event_checklist_items i
     set removed_at = now(), updated_at = now()
   where i.checklist_id = p_checklist
     and i.origin = 'contract'
     and i.removed_at is null
     and (
       i.line_id is null
       or not exists (select 1 from public.av_opportunity_lines l where l.id = i.line_id)
       or exists (
         select 1 from public.av_opportunity_lines l
         join public.av_products p on p.id = l.product_id
         where l.id = i.line_id
           and p.kind = 'package'
           and exists (select 1 from public.av_opportunity_lines k where k.parent_line_id = l.id)
       )
     );
end;
$$;

create or replace function public.event_checklist_sync_for_opportunity(p_opportunity uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select id from public.event_checklists where opportunity_id = p_opportunity loop
    perform public.event_checklist_sync(r.id);
  end loop;
end;
$$;

create or replace function public.event_checklist_line_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.event_checklist_sync_for_opportunity(coalesce(new.opportunity_id, old.opportunity_id));
  return null;
end;
$$;

drop trigger if exists av_opportunity_lines_checklist_sync on public.av_opportunity_lines;
create trigger av_opportunity_lines_checklist_sync
  after insert or update or delete on public.av_opportunity_lines
  for each row execute function public.event_checklist_line_trigger();

-- Build the checklist for a project (idempotent) and pull its estimate's gear in.
create or replace function public.event_checklist_ensure(p_project uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_opp  record;
begin
  if not public.checklist_can_access(p_project) then
    raise exception 'Not allowed';
  end if;

  select id into v_id from public.event_checklists where project_id = p_project;
  select o.id, o.gear_starts_at, o.gear_ends_at into v_opp
  from public.av_opportunities o
  where o.honeybook_project_id = p_project and coalesce(o.is_template, false) = false
  order by o.created_at desc limit 1;

  if v_id is null then
    insert into public.event_checklists (project_id, opportunity_id, depart_at, return_at, created_by)
    values (p_project, v_opp.id, v_opp.gear_starts_at, v_opp.gear_ends_at, auth.uid())
    returning id into v_id;
  elsif v_opp.id is not null then
    update public.event_checklists
       set opportunity_id = v_opp.id,
           depart_at = coalesce(depart_at, v_opp.gear_starts_at),
           return_at = coalesce(return_at, v_opp.gear_ends_at),
           updated_at = now()
     where id = v_id and opportunity_id is distinct from v_opp.id;
  end if;

  perform public.event_checklist_sync(v_id);
  return v_id;
end;
$$;

grant execute on function public.event_checklist_ensure(uuid) to authenticated;
grant execute on function public.event_checklist_sync(uuid) to service_role;
grant execute on function public.checklist_can_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Photos for damaged / missing flags
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('checklist-photos', 'checklist-photos', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "checklist photos staff read" on storage.objects;
create policy "checklist photos staff read" on storage.objects for select to authenticated
  using (bucket_id = 'checklist-photos' and public.current_user_role()::text in ('admin', 'trainer', 'staff'));
drop policy if exists "checklist photos staff insert" on storage.objects;
create policy "checklist photos staff insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'checklist-photos' and public.current_user_role()::text in ('admin', 'trainer', 'staff'));
