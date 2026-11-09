-- 061 Notification preferences: per-user muted notification kinds.
-- A BEFORE INSERT trigger on hub_notifications drops notifications of a kind
-- the recipient has muted, so every insertion path (helpers + SECURITY DEFINER
-- functions) is respected without changing each caller.

create table if not exists public.notification_mutes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind)
);

create index if not exists notification_mutes_user_idx on public.notification_mutes (user_id);

alter table public.notification_mutes enable row level security;

drop policy if exists "notification_mutes own" on public.notification_mutes;
create policy "notification_mutes own"
  on public.notification_mutes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.notification_mutes to authenticated;

create or replace function public.hub_notifications_respect_mutes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.notification_mutes m
    where m.user_id = new.user_id and m.kind = new.kind
  ) then
    return null; -- recipient muted this kind: skip the notification
  end if;
  return new;
end;
$$;

drop trigger if exists hub_notifications_mutes on public.hub_notifications;
create trigger hub_notifications_mutes
  before insert on public.hub_notifications
  for each row execute function public.hub_notifications_respect_mutes();
