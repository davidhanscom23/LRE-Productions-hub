-- Subject can see and check off their own onboarding plan.
-- Hire → invite links profile_id; admins keep full manage access.

drop policy if exists "onboarding_plans subject select" on public.onboarding_plans;
create policy "onboarding_plans subject select"
on public.onboarding_plans
for select
to authenticated
using (
  public.is_admin()
  or (profile_id is not null and profile_id = auth.uid())
);

drop policy if exists "onboarding_items subject select" on public.onboarding_items;
create policy "onboarding_items subject select"
on public.onboarding_items
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.onboarding_plans p
    where p.id = plan_id
      and p.profile_id = auth.uid()
  )
);

-- Narrow subject toggle via SECURITY DEFINER (cannot rewrite label/category).
create or replace function public.toggle_my_onboarding_item(
  p_item_id uuid,
  p_done boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  plan_profile uuid;
begin
  if uid is null then
    return jsonb_build_object('error', 'unauthenticated');
  end if;
  if public.current_user_role()::text = 'guest' then
    return jsonb_build_object('error', 'guest');
  end if;

  select p.profile_id into plan_profile
  from public.onboarding_items i
  join public.onboarding_plans p on p.id = i.plan_id
  where i.id = p_item_id;

  if plan_profile is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  if plan_profile is distinct from uid and not public.is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  update public.onboarding_items
  set
    is_done = p_done,
    done_at = case when p_done then now() else null end,
    done_by = case when p_done then uid else null end
  where id = p_item_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.toggle_my_onboarding_item(uuid, boolean) from public;
grant execute on function public.toggle_my_onboarding_item(uuid, boolean) to authenticated;

-- Managers can work reviews for their direct reports (legacy + dept managers).
create or replace function public.is_manager_of(p_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = p_subject and p.reports_to = auth.uid()
    )
    or exists (
      select 1 from public.profile_department_managers pdm
      where pdm.profile_id = p_subject and pdm.reports_to = auth.uid()
    );
$$;

revoke all on function public.is_manager_of(uuid) from public;
grant execute on function public.is_manager_of(uuid) to authenticated;

-- Managers select/update reviews for their reports; staff still use list_my_reviews.
drop policy if exists "reviews manager select" on public.performance_reviews;
create policy "reviews manager select"
on public.performance_reviews
for select
to authenticated
using (public.is_manager_of(subject_id));

drop policy if exists "reviews manager update" on public.performance_reviews;
create policy "reviews manager update"
on public.performance_reviews
for update
to authenticated
using (public.is_manager_of(subject_id))
with check (public.is_manager_of(subject_id));

drop policy if exists "reviews manager insert" on public.performance_reviews;
create policy "reviews manager insert"
on public.performance_reviews
for insert
to authenticated
with check (public.is_manager_of(subject_id));

create or replace function public.list_managed_reviews()
returns setof public.performance_reviews
language sql
stable
security definer
set search_path = public
as $$
  select r.*
  from public.performance_reviews r
  where public.is_manager_of(r.subject_id)
  order by r.updated_at desc;
$$;

revoke all on function public.list_managed_reviews() from public;
grant execute on function public.list_managed_reviews() to authenticated;
