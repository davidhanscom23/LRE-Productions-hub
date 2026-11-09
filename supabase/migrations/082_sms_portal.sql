-- SMS Portal: two-way staff texting via Twilio.
-- Every message (outbound + inbound) is one row; a "conversation" is all rows
-- for a given contact_phone. Reads/writes go through admin-gated API routes
-- using the service role, so these tables are locked down at the RLS layer.

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  contact_phone text not null,                 -- E.164, e.g. +19045551234
  staff_id uuid references public.profiles (id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound')),
  body text not null,
  status text,                                 -- queued/sent/delivered/failed/received…
  twilio_sid text,
  sent_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sms_messages_contact_idx
  on public.sms_messages (contact_phone, created_at desc);
create index if not exists sms_messages_created_idx
  on public.sms_messages (created_at desc);

-- STOP/unsubscribe list: a phone here must not receive further texts.
create table if not exists public.sms_opt_outs (
  phone text primary key,                      -- E.164
  created_at timestamptz not null default now()
);

alter table public.sms_messages enable row level security;
alter table public.sms_opt_outs enable row level security;

-- No direct client access: the browser never queries these tables. All access
-- is server-side via admin-gated routes using the service role (which bypasses
-- RLS). Enabling RLS with no permissive policy = deny to anon/authenticated.
grant select, insert, update, delete on public.sms_messages to service_role;
grant select, insert, update, delete on public.sms_opt_outs to service_role;
