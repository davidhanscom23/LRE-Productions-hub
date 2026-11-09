-- Floor plans: a 2D floor plan designer for HoneyBook projects, plus reusable templates.
-- A plan with project_id set belongs to a project; project_id null + is_template = true is a template.

insert into storage.buckets (id, name, public, file_size_limit)
values ('floor-plan-blueprints', 'floor-plan-blueprints', false, 15728640)
on conflict (id) do nothing;

create table if not exists public.floor_plans (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.honeybook_projects (id) on delete cascade,
  is_template   boolean not null default false,
  name          text not null default 'Untitled floor plan',
  space_name    text not null default '',
  status        text not null default 'draft',
  share_token   text unique,
  data          jsonb not null default '{}'::jsonb,
  created_by    uuid references public.profiles (id) on delete set null,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint floor_plans_status_check check (status in ('draft', 'published')),
  constraint floor_plans_owner_check check (
    (is_template = true and project_id is null)
    or (is_template = false and project_id is not null)
  )
);

create index if not exists floor_plans_project_idx on public.floor_plans (project_id, updated_at desc);
create index if not exists floor_plans_template_idx on public.floor_plans (is_template, updated_at desc);

comment on table public.floor_plans is
  'Hub floor plan designer: elements, blueprint and scale live in data (jsonb). Clients see published plans at /floorplan/<share_token>.';

alter table public.floor_plans enable row level security;

drop policy if exists "floor_plans select staff" on public.floor_plans;
create policy "floor_plans select staff"
  on public.floor_plans for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));

drop policy if exists "floor_plans admin lead write" on public.floor_plans;
create policy "floor_plans admin lead write"
  on public.floor_plans for all to authenticated
  using (public.current_user_role() in ('admin', 'trainer'))
  with check (public.current_user_role() in ('admin', 'trainer'));

-- Staff assigned to the project can create and edit its plans (never templates).
drop policy if exists "floor_plans assignee write" on public.floor_plans;
create policy "floor_plans assignee write"
  on public.floor_plans for all to authenticated
  using (
    public.current_user_role() = 'staff'
    and is_template = false
    and exists (
      select 1 from public.honeybook_project_assignees a
      where a.project_id = floor_plans.project_id
        and a.profile_id = auth.uid()
    )
  )
  with check (
    public.current_user_role() = 'staff'
    and is_template = false
    and exists (
      select 1 from public.honeybook_project_assignees a
      where a.project_id = floor_plans.project_id
        and a.profile_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.floor_plans to authenticated;
grant select, insert, update, delete on public.floor_plans to service_role;
