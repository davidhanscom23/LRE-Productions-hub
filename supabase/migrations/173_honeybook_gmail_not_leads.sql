-- "Not a lead" feedback for the HoneyBook email monitor.
-- When staff click "Not a lead" on an email-created card, the Hub deletes the card and
-- remembers the sender address and email thread here, so that mail is skipped next time.
-- Recent rows are also shown to the classifier as examples of what is NOT an inquiry.
-- Stores a short summary written by the Hub, never the email text.

create table if not exists public.honeybook_gmail_not_leads (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('sender', 'thread')),
  -- kind = 'sender': the prospect's address (never a shared marketplace relay or a Vident address)
  sender_email  text not null default '',
  -- kind = 'thread': the staff mailbox and Gmail thread that was marked
  mailbox       text not null default '',
  thread_id     text not null default '',
  -- Short summary of what the email was about, shown to the classifier as an example.
  summary       text not null default '',
  project_name  text not null default '',
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create unique index if not exists honeybook_gmail_not_leads_sender_uidx
  on public.honeybook_gmail_not_leads (sender_email)
  where kind = 'sender';

create unique index if not exists honeybook_gmail_not_leads_thread_uidx
  on public.honeybook_gmail_not_leads (mailbox, thread_id)
  where kind = 'thread';

create index if not exists honeybook_gmail_not_leads_recent_idx
  on public.honeybook_gmail_not_leads (created_at desc);

alter table public.honeybook_gmail_not_leads enable row level security;

drop policy if exists "honeybook_gmail_not_leads admin select" on public.honeybook_gmail_not_leads;
create policy "honeybook_gmail_not_leads admin select"
  on public.honeybook_gmail_not_leads for select to authenticated
  using (public.is_admin());

grant select on public.honeybook_gmail_not_leads to authenticated;
grant select, insert, update, delete on public.honeybook_gmail_not_leads to service_role;
