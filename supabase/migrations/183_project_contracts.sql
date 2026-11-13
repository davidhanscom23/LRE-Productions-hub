-- Contracts and e-sign for Pipeline projects (non-AV). Templates are reusable wording;
-- a contract is a frozen copy for one project, sent as a /sign/<token> link.

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-contracts', 'project-contracts', false, 15728640)
on conflict (id) do nothing;

create table if not exists public.contract_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  body        text not null default '',
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists contract_templates_name_uidx on public.contract_templates (lower(btrim(name)));

create table if not exists public.project_contracts (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.pipeline_projects (id) on delete cascade,
  title              text not null default 'Agreement',
  body               text not null default '',
  status             text not null default 'draft'
                       check (status in ('draft', 'sent', 'signed', 'declined', 'void')),
  sign_token         text not null unique,
  body_hash          text,
  sent_at            timestamptz,
  signer_name        text not null default '',
  signer_email       text not null default '',
  signed_at          timestamptz,
  signature_data     text,
  signer_ip          text,
  signer_user_agent  text,
  response_note      text not null default '',
  signed_pdf_path    text,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists project_contracts_project_idx on public.project_contracts (project_id, created_at desc);

alter table public.contract_templates enable row level security;
alter table public.project_contracts enable row level security;

drop policy if exists "contract templates read staff" on public.contract_templates;
create policy "contract templates read staff" on public.contract_templates for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));
drop policy if exists "contract templates write admin lead" on public.contract_templates;
create policy "contract templates write admin lead" on public.contract_templates for all to authenticated
  using (public.current_user_role() in ('admin', 'trainer'))
  with check (public.current_user_role() in ('admin', 'trainer'));

drop policy if exists "project contracts read staff" on public.project_contracts;
create policy "project contracts read staff" on public.project_contracts for select to authenticated
  using (public.current_user_role() in ('admin', 'trainer', 'staff'));
drop policy if exists "project contracts write admin lead" on public.project_contracts;
create policy "project contracts write admin lead" on public.project_contracts for all to authenticated
  using (public.current_user_role() in ('admin', 'trainer'))
  with check (public.current_user_role() in ('admin', 'trainer'));

grant select, insert, update, delete on public.contract_templates to authenticated, service_role;
grant select, insert, update, delete on public.project_contracts to authenticated, service_role;

-- Starter wording. Plain and generic: have your attorney review and replace it before real use.
insert into public.contract_templates (name, body)
values (
  'Event Services Agreement (starter)',
  $tpl$EVENT SERVICES AGREEMENT

This agreement is between {{company_name}} ("Vident") and {{client_name}} ("Client"), dated {{today}}.

1. EVENT
Event: {{project_name}}
Date: {{event_date}}
Location: {{location}}

2. SERVICES
Vident will provide the production services, equipment and staffing listed in the most recent proposal or invoice for this event. Changes to the services must be agreed in writing by both parties.

3. FEES AND PAYMENT
Fees are shown on the invoice for this event. A retainer is due to reserve the date and the balance is due by the date shown on the invoice. The date is not held until the retainer is received.

4. CANCELLATION AND RESCHEDULING
If Client cancels, the retainer is not refunded because the date was held exclusively for Client. If Client reschedules, Vident will apply the retainer to the new date when the new date is available.

5. CLIENT RESPONSIBILITIES
Client will provide safe access to the venue, working power, and the planning details Vident reasonably requests by the dates it requests them.

6. EQUIPMENT
Equipment supplied by Vident remains Vident's property. Client is responsible for loss or damage to equipment caused by Client or its guests, other than normal wear.

7. WEATHER AND EVENTS OUTSIDE OUR CONTROL
Neither party is responsible for delay or failure caused by events outside its reasonable control, including severe weather, venue closure, power failure, illness or government action. Vident will work in good faith with Client to find a workable solution.

8. LIABILITY
Vident's total liability under this agreement is limited to the fees paid by Client for this event.

9. WHOLE AGREEMENT
This agreement, with the proposal and invoice for this event, is the whole agreement and may be changed only in writing signed or accepted electronically by both parties. Florida law applies.

By signing below, Client agrees to these terms and confirms the information above is correct.$tpl$
)
on conflict do nothing;
