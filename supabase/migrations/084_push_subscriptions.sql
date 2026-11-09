-- Web push subscriptions: one row per browser/device a staff member enables
-- notifications on. The hub sends a push here whenever it writes a hub
-- notification (huddles, scheduled huddles, SMS, etc.), so alerts reach phones.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A user manages only their own subscriptions from the browser.
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;
-- The push sender reads every recipient's subscriptions with the service role.
grant select, insert, update, delete on public.push_subscriptions to service_role;
