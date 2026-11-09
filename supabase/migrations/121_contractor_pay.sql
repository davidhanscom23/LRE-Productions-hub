-- Contractor Pay: payment requests (separate from expenses) + mini 1099 hub
-- (annual acknowledgment e-sign + W-9 file collection).

create table if not exists public.contractor_payment_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  amount          numeric(10,2) not null check (amount > 0),
  category        text not null default 'other'
                    check (category in (
                      'event_day',
                      'hourly',
                      'flat_fee',
                      'bonus',
                      'other'
                    )),
  description     text not null default '',
  work_date       date not null,
  event_name      text not null default '',
  hours           numeric(8,2),
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'denied')),
  paid_at         timestamptz,
  reviewed_by     uuid references public.profiles(id),
  reviewed_at     timestamptz,
  review_note     text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists contractor_pay_user_idx
  on public.contractor_payment_requests (user_id);
create index if not exists contractor_pay_status_idx
  on public.contractor_payment_requests (status);

alter table public.contractor_payment_requests enable row level security;

drop policy if exists "contractor pay read own or admin"
  on public.contractor_payment_requests;
create policy "contractor pay read own or admin"
  on public.contractor_payment_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "contractor pay insert own"
  on public.contractor_payment_requests;
create policy "contractor pay insert own"
  on public.contractor_payment_requests for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "contractor pay update own pending or admin"
  on public.contractor_payment_requests;
create policy "contractor pay update own pending or admin"
  on public.contractor_payment_requests for update to authenticated
  using ((user_id = auth.uid() and status = 'pending') or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "contractor pay delete own or admin"
  on public.contractor_payment_requests;
create policy "contractor pay delete own or admin"
  on public.contractor_payment_requests for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete
  on public.contractor_payment_requests to authenticated;

-- Annual 1099 acknowledgment (e-sign) per tax year.
create table if not exists public.contractor_1099_acknowledgements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  tax_year        integer not null
                    check (tax_year >= 2020 and tax_year <= 2100),
  signer_name     text not null,
  signer_email    text not null default '',
  signature_data  text not null,
  acknowledgment  text not null default '',
  ip_address      text,
  user_agent      text,
  signed_at       timestamptz not null default now(),
  unique (user_id, tax_year)
);

create index if not exists contractor_1099_ack_user_idx
  on public.contractor_1099_acknowledgements (user_id);
create index if not exists contractor_1099_ack_year_idx
  on public.contractor_1099_acknowledgements (tax_year desc);

alter table public.contractor_1099_acknowledgements enable row level security;

drop policy if exists "contractor 1099 ack read own or admin"
  on public.contractor_1099_acknowledgements;
create policy "contractor 1099 ack read own or admin"
  on public.contractor_1099_acknowledgements for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "contractor 1099 ack insert own"
  on public.contractor_1099_acknowledgements;
create policy "contractor 1099 ack insert own"
  on public.contractor_1099_acknowledgements for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "contractor 1099 ack update own"
  on public.contractor_1099_acknowledgements;
create policy "contractor 1099 ack update own"
  on public.contractor_1099_acknowledgements for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update
  on public.contractor_1099_acknowledgements to authenticated;

-- W-9 file uploads (history kept; latest per user is current).
create table if not exists public.contractor_w9_files (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  tax_year           integer not null
                       check (tax_year >= 2020 and tax_year <= 2100),
  storage_path       text not null,
  storage_provider   text not null default 'supabase',
  file_name          text not null default '',
  content_type       text not null default 'application/pdf',
  uploaded_at        timestamptz not null default now()
);

create index if not exists contractor_w9_user_idx
  on public.contractor_w9_files (user_id, uploaded_at desc);
create index if not exists contractor_w9_year_idx
  on public.contractor_w9_files (tax_year desc);

alter table public.contractor_w9_files enable row level security;

drop policy if exists "contractor w9 read own or admin"
  on public.contractor_w9_files;
create policy "contractor w9 read own or admin"
  on public.contractor_w9_files for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "contractor w9 insert own"
  on public.contractor_w9_files;
create policy "contractor w9 insert own"
  on public.contractor_w9_files for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "contractor w9 delete own or admin"
  on public.contractor_w9_files;
create policy "contractor w9 delete own or admin"
  on public.contractor_w9_files for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select, insert, delete on public.contractor_w9_files to authenticated;

comment on table public.contractor_payment_requests is
  'Staff/contractor payment requests (not expense reimbursements).';
comment on table public.contractor_1099_acknowledgements is
  'Annual 1099 contractor acknowledgment e-signatures by tax year.';
comment on table public.contractor_w9_files is
  'Uploaded W-9 PDFs/images for contractor tax collection.';

-- Notify admins of a new contractor payment request.
create or replace function public.notify_admins_of_contractor_payment(
  p_payment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.contractor_payment_requests%rowtype;
  requester text;
  a record;
begin
  select * into pay from public.contractor_payment_requests where id = p_payment_id;
  if not found then return; end if;
  if pay.user_id <> auth.uid() then raise exception 'Not your payment request'; end if;

  select full_name into requester from public.profiles where id = pay.user_id;

  for a in select id from public.profiles where role = 'admin' loop
    insert into public.hub_notifications (user_id, kind, title, body, href)
    values (
      a.id,
      'contractor_pay',
      'New contractor payment to review',
      coalesce(nullif(requester, ''), 'A staffer') || ' submitted $'
        || to_char(pay.amount, 'FM999999990.00') || ' (' || pay.category || ').',
      '/contractor-pay'
    );
  end loop;
end;
$$;

grant execute on function public.notify_admins_of_contractor_payment(uuid)
  to authenticated;

-- Treat contractor_pay outcomes as mandatory (non-admins cannot mute).
drop policy if exists "notification_mutes own" on public.notification_mutes;
create policy "notification_mutes own"
  on public.notification_mutes for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      public.is_admin()
      or kind not in (
        'announcement',
        'time_off',
        'expense',
        'contractor_pay',
        'review',
        'action',
        'action_overdue'
      )
    )
  );

delete from public.notification_mutes m
where m.kind in (
  'announcement',
  'time_off',
  'expense',
  'contractor_pay',
  'review',
  'action',
  'action_overdue'
)
and not exists (
  select 1 from public.profiles p where p.id = m.user_id and p.role = 'admin'
);
