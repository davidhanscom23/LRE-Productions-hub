-- Event info for the gear checklist: contacts (tap to call / email), venue + room, load-in
-- details that stay with the venue, and floor plans. Everything is read through one secure
-- function so assigned staff can see their own event without wider table access.

-- 1. Load-in details live on the venue, so they build up over time and persist until updated.
alter table public.av_job_venues
  add column if not exists loading_dock_notes text not null default '',
  add column if not exists path_notes text not null default '',
  add column if not exists load_in_hours text not null default '',
  add column if not exists venue_rules text not null default '',
  add column if not exists loadin_updated_by uuid references public.profiles (id) on delete set null,
  add column if not exists loadin_updated_at timestamptz;

-- 2. Which venue and room this event uses (defaults from the estimate, editable by hand).
alter table public.event_checklists
  add column if not exists venue_id uuid references public.av_job_venues (id) on delete set null,
  add column if not exists room text not null default '';

-- 3. Everything the checklist page needs about the event, in one call.
create or replace function public.event_checklist_info(p_project uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_proj    record;
  v_cl      record;
  v_venue   record;
  v_opp     record;
  v_cust    record;
  v_client  record;
  v_staff   jsonb;
  v_plans   jsonb;
begin
  if not public.checklist_can_access(p_project) then
    raise exception 'Not allowed';
  end if;

  select id, name, project_date, location, client_id into v_proj
  from public.pipeline_projects where id = p_project;
  if not found then
    return null;
  end if;

  select * into v_cl from public.event_checklists where project_id = p_project;

  select o.id, o.reference, o.customer_id, o.venue_id into v_opp
  from public.av_opportunities o
  where o.pipeline_project_id = p_project and coalesce(o.is_template, false) = false
  order by o.created_at desc limit 1;

  select * into v_venue
  from public.av_job_venues
  where id = coalesce(v_cl.venue_id, v_opp.venue_id);

  select full_name, email, phone into v_client
  from public.pipeline_clients where id = v_proj.client_id;

  select name, contact_name, email, phone into v_cust
  from public.av_customers where id = v_opp.customer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', coalesce(nullif(pr.full_name, ''), 'Staff'),
           'role', a.role,
           'phone', coalesce(pr.phone, ''),
           'email', coalesce(pr.email, '')
         ) order by (a.role = 'lead') desc, pr.full_name), '[]'::jsonb)
    into v_staff
  from public.pipeline_project_assignees a
  join public.profiles pr on pr.id = a.profile_id
  where a.project_id = p_project;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', f.id,
           'name', f.name,
           'space_name', f.space_name,
           'data', f.data
         ) order by f.updated_at desc), '[]'::jsonb)
    into v_plans
  from public.floor_plans f
  where f.project_id = p_project and f.is_template = false;

  return jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_proj.id, 'name', v_proj.name,
      'project_date', v_proj.project_date, 'location', v_proj.location),
    'room', coalesce(v_cl.room, ''),
    'venue', case when v_venue.id is null then null else jsonb_build_object(
      'id', v_venue.id, 'name', v_venue.name,
      'contact_name', v_venue.contact_name, 'email', v_venue.email, 'phone', v_venue.phone,
      'address_line1', v_venue.address_line1, 'address_line2', v_venue.address_line2,
      'city', v_venue.city, 'region', v_venue.region, 'postal_code', v_venue.postal_code,
      'access_notes', v_venue.access_notes, 'power_notes', v_venue.power_notes,
      'parking_notes', v_venue.parking_notes,
      'loading_dock_notes', v_venue.loading_dock_notes, 'path_notes', v_venue.path_notes,
      'load_in_hours', v_venue.load_in_hours, 'venue_rules', v_venue.venue_rules,
      'loadin_updated_at', v_venue.loadin_updated_at) end,
    'client', case when v_client.full_name is null and v_client.email is null then null
      else jsonb_build_object('name', v_client.full_name, 'email', v_client.email, 'phone', v_client.phone) end,
    'customer', case when v_cust.name is null then null
      else jsonb_build_object('name', v_cust.name, 'contact_name', v_cust.contact_name,
                              'email', v_cust.email, 'phone', v_cust.phone) end,
    'staff', v_staff,
    'floor_plans', v_plans
  );
end;
$$;

-- 4. Save venue / room / load-in details (also creates a venue when the person types a new one).
create or replace function public.event_checklist_save_venue(
  p_project uuid,
  p_venue_id uuid,
  p_venue_name text,
  p_room text,
  p_fields jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_venue_id;
  v_cl uuid;
begin
  if not public.checklist_can_access(p_project) then
    raise exception 'Not allowed';
  end if;
  select id into v_cl from public.event_checklists where project_id = p_project;
  if v_cl is null then
    raise exception 'Open the checklist first';
  end if;

  if v_id is null and btrim(coalesce(p_venue_name, '')) <> '' then
    select id into v_id from public.av_job_venues
     where lower(name) = lower(btrim(p_venue_name)) and not is_retired limit 1;
    if v_id is null then
      insert into public.av_job_venues (name, created_by)
      values (btrim(p_venue_name), auth.uid()) returning id into v_id;
    end if;
  end if;

  if v_id is not null then
    update public.av_job_venues set
      contact_name       = coalesce(p_fields ->> 'contact_name', contact_name),
      email              = coalesce(p_fields ->> 'email', email),
      phone              = coalesce(p_fields ->> 'phone', phone),
      address_line1      = coalesce(p_fields ->> 'address_line1', address_line1),
      city               = coalesce(p_fields ->> 'city', city),
      region             = coalesce(p_fields ->> 'region', region),
      postal_code        = coalesce(p_fields ->> 'postal_code', postal_code),
      access_notes       = coalesce(p_fields ->> 'access_notes', access_notes),
      power_notes        = coalesce(p_fields ->> 'power_notes', power_notes),
      parking_notes      = coalesce(p_fields ->> 'parking_notes', parking_notes),
      loading_dock_notes = coalesce(p_fields ->> 'loading_dock_notes', loading_dock_notes),
      path_notes         = coalesce(p_fields ->> 'path_notes', path_notes),
      load_in_hours      = coalesce(p_fields ->> 'load_in_hours', load_in_hours),
      venue_rules        = coalesce(p_fields ->> 'venue_rules', venue_rules),
      loadin_updated_by  = auth.uid(),
      loadin_updated_at  = now(),
      updated_at         = now()
    where id = v_id;
  end if;

  update public.event_checklists
     set venue_id = v_id, room = left(coalesce(p_room, ''), 200), updated_at = now()
   where id = v_cl;
  return v_id;
end;
$$;

grant execute on function public.event_checklist_info(uuid) to authenticated;
grant execute on function public.event_checklist_save_venue(uuid, uuid, text, text, jsonb) to authenticated;

-- Venue picker for the checklist (names only).
create or replace function public.event_checklist_venue_options()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.name from public.av_job_venues v
  where not v.is_retired and public.current_user_role()::text in ('admin', 'trainer', 'staff')
  order by lower(v.name) limit 500;
$$;
grant execute on function public.event_checklist_venue_options() to authenticated;

-- 5. Inventory list for adding gear by hand (non-AV events use the same internal inventory).
create or replace function public.event_checklist_product_options()
returns table (id uuid, name text, kind text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.kind from public.av_products p
  where p.is_active and p.kind <> 'package'
    and public.current_user_role()::text in ('admin', 'trainer', 'staff')
  order by lower(p.name) limit 3000;
$$;
grant execute on function public.event_checklist_product_options() to authenticated;
