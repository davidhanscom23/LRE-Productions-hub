-- 056 Expenses / reimbursements. Staff submit; admins approve/deny and mark paid.

create table if not exists public.expense_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  amount       numeric(10,2) not null check (amount > 0),
  category     text not null default 'other'
                 check (category in ('travel','mileage','gear','meals','supplies','other')),
  description  text not null default '',
  expense_date date not null,
  receipt_url  text not null default '',
  status       text not null default 'pending'
                 check (status in ('pending','approved','denied')),
  reimbursed_at timestamptz,
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  review_note  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists expense_user_idx on public.expense_requests (user_id);
create index if not exists expense_status_idx on public.expense_requests (status);

alter table public.expense_requests enable row level security;

drop policy if exists "expense read own or admin" on public.expense_requests;
create policy "expense read own or admin"
  on public.expense_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "expense insert own" on public.expense_requests;
create policy "expense insert own"
  on public.expense_requests for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "expense update own pending or admin" on public.expense_requests;
create policy "expense update own pending or admin"
  on public.expense_requests for update to authenticated
  using ((user_id = auth.uid() and status = 'pending') or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "expense delete own or admin" on public.expense_requests;
create policy "expense delete own or admin"
  on public.expense_requests for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.expense_requests to authenticated;

-- Notify admins of a new expense (SECURITY DEFINER so a non-admin submitter
-- can create the notification for their OWN expense only).
create or replace function public.notify_admins_of_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  exp public.expense_requests%rowtype;
  requester text;
  a record;
begin
  select * into exp from public.expense_requests where id = p_expense_id;
  if not found then return; end if;
  if exp.user_id <> auth.uid() then raise exception 'Not your expense'; end if;

  select full_name into requester from public.profiles where id = exp.user_id;

  for a in select id from public.profiles where role = 'admin' loop
    insert into public.hub_notifications (user_id, kind, title, body, href)
    values (
      a.id,
      'expense',
      'New expense to review',
      coalesce(nullif(requester, ''), 'A staffer') || ' submitted $'
        || to_char(exp.amount, 'FM999999990.00') || ' (' || exp.category || ').',
      '/expenses'
    );
  end loop;
end;
$$;

grant execute on function public.notify_admins_of_expense(uuid) to authenticated;
