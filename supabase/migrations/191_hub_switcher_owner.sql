-- Only the owner (David) assigns who sees which hub tile. Admins no longer see every tile automatically.
alter table public.profiles add column if not exists is_owner boolean not null default false;

create or replace function public.profiles_protect_owner() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.is_owner is distinct from old.is_owner and auth.uid() is not null then
    raise exception 'is_owner can only be changed from the SQL editor';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_owner on public.profiles;
create trigger profiles_protect_owner before update on public.profiles
  for each row execute function public.profiles_protect_owner();

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_owner);
$$;
revoke execute on function private.is_owner() from public, anon;
grant execute on function private.is_owner() to authenticated;

drop policy if exists "hub links write admin" on public.hub_links;
drop policy if exists "hub links write owner" on public.hub_links;
create policy "hub links write owner" on public.hub_links for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

drop policy if exists "hub link access read own or admin" on public.hub_link_access;
drop policy if exists "hub link access read own or owner" on public.hub_link_access;
create policy "hub link access read own or owner" on public.hub_link_access for select to authenticated
  using (profile_id = auth.uid() or private.is_owner());

drop policy if exists "hub link access write admin" on public.hub_link_access;
drop policy if exists "hub link access write owner" on public.hub_link_access;
create policy "hub link access write owner" on public.hub_link_access for all to authenticated
  using (private.is_owner()) with check (private.is_owner());

-- The SQL editor has no signed-in user, so pause the profile triggers for this one update only.
alter table public.profiles disable trigger user;
update public.profiles set is_owner = true where email = 'david@yentertainmentdjs.com';
alter table public.profiles enable trigger user;
