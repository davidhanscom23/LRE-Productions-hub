-- Quoting: department pricing notes + quotes with >20% discount approval.

create table if not exists public.quote_pricing_notes (
  id           uuid primary key default gen_random_uuid(),
  department   text not null default 'General',
  title        text not null default '',
  body         text not null default '',
  sort_order   integer not null default 0,
  created_by   uuid references public.profiles(id) on delete set null,
  updated_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint quote_pricing_notes_title_not_blank check (
    char_length(trim(title)) > 0
  )
);

create index if not exists quote_pricing_notes_dept_idx
  on public.quote_pricing_notes (department, sort_order, title);

alter table public.quote_pricing_notes enable row level security;

drop policy if exists "quote notes read (non-guest)" on public.quote_pricing_notes;
create policy "quote notes read (non-guest)"
  on public.quote_pricing_notes for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role is distinct from 'guest'
  ));

drop policy if exists "quote notes write (non-guest)" on public.quote_pricing_notes;
create policy "quote notes write (non-guest)"
  on public.quote_pricing_notes for all to authenticated
  using (public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role is distinct from 'guest'
  ))
  with check (public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role is distinct from 'guest'
  ));

grant select, insert, update, delete on public.quote_pricing_notes to authenticated;

-- Quote headers
create table if not exists public.quotes (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null references public.profiles(id) on delete cascade,
  client_name     text not null default '',
  event_name      text not null default '',
  event_date      date,
  department      text not null default 'General',
  status          text not null default 'draft'
                    check (status in (
                      'draft',
                      'pending_approval',
                      'ready',
                      'denied'
                    )),
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists quotes_created_by_idx on public.quotes (created_by);
create index if not exists quotes_status_idx on public.quotes (status);
create index if not exists quotes_updated_idx on public.quotes (updated_at desc);

alter table public.quotes enable row level security;

drop policy if exists "quotes read own or admin" on public.quotes;
create policy "quotes read own or admin"
  on public.quotes for select to authenticated
  using (created_by = auth.uid() or public.is_admin());

drop policy if exists "quotes insert own" on public.quotes;
create policy "quotes insert own"
  on public.quotes for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "quotes update own or admin" on public.quotes;
create policy "quotes update own or admin"
  on public.quotes for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "quotes delete own or admin" on public.quotes;
create policy "quotes delete own or admin"
  on public.quotes for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.quotes to authenticated;

-- Line items
create table if not exists public.quote_line_items (
  id                uuid primary key default gen_random_uuid(),
  quote_id          uuid not null references public.quotes(id) on delete cascade,
  label             text not null default '',
  quantity          numeric(10,2) not null default 1 check (quantity > 0),
  list_unit_price   numeric(12,2) not null default 0 check (list_unit_price >= 0),
  quote_unit_price  numeric(12,2) not null default 0 check (quote_unit_price >= 0),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  constraint quote_line_label_not_blank check (char_length(trim(label)) > 0)
);

create index if not exists quote_line_items_quote_idx
  on public.quote_line_items (quote_id, sort_order);

alter table public.quote_line_items enable row level security;

drop policy if exists "quote lines via quote access" on public.quote_line_items;
create policy "quote lines via quote access"
  on public.quote_line_items for all to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and (q.created_by = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and (q.created_by = auth.uid() or public.is_admin())
    )
  );

grant select, insert, update, delete on public.quote_line_items to authenticated;

-- Discount approval requests (>20% line or total decrease)
create table if not exists public.quote_discount_approvals (
  id                  uuid primary key default gen_random_uuid(),
  quote_id            uuid not null references public.quotes(id) on delete cascade,
  requested_by        uuid references public.profiles(id) on delete set null,
  reason              text not null default '',
  list_total          numeric(12,2) not null default 0,
  quote_total         numeric(12,2) not null default 0,
  total_decrease_pct  numeric(8,4) not null default 0,
  line_breaches       jsonb not null default '[]'::jsonb,
  lines_snapshot      jsonb not null default '[]'::jsonb,
  status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'denied')),
  reviewed_by         uuid references public.profiles(id) on delete set null,
  review_note         text not null default '',
  created_at          timestamptz not null default now(),
  reviewed_at         timestamptz
);

create index if not exists quote_discount_approvals_quote_idx
  on public.quote_discount_approvals (quote_id, created_at desc);
create index if not exists quote_discount_approvals_status_idx
  on public.quote_discount_approvals (status);

alter table public.quote_discount_approvals enable row level security;

drop policy if exists "quote approvals read own or admin"
  on public.quote_discount_approvals;
create policy "quote approvals read own or admin"
  on public.quote_discount_approvals for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.created_by = auth.uid()
    )
  );

drop policy if exists "quote approvals insert requester"
  on public.quote_discount_approvals;
create policy "quote approvals insert requester"
  on public.quote_discount_approvals for insert to authenticated
  with check (
    requested_by = auth.uid()
    and exists (
      select 1 from public.quotes q
      where q.id = quote_id and q.created_by = auth.uid()
    )
  );

drop policy if exists "quote approvals update admin"
  on public.quote_discount_approvals;
create policy "quote approvals update admin"
  on public.quote_discount_approvals for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.quote_discount_approvals to authenticated;

comment on table public.quote_pricing_notes is
  'Editable department checklist / pricing guidance for Quoting.';
comment on table public.quotes is
  'Event/service quotes with list vs quoted pricing.';
comment on table public.quote_discount_approvals is
  'Admin approve/deny when quote decreases list price by more than 20% on a line or total.';

create or replace function public.notify_admins_of_quote_discount(
  p_approval_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  appr public.quote_discount_approvals%rowtype;
  q public.quotes%rowtype;
  requester text;
  a record;
begin
  select * into appr from public.quote_discount_approvals where id = p_approval_id;
  if not found then return; end if;
  if appr.requested_by is distinct from auth.uid() then
    raise exception 'Not your approval request';
  end if;

  select * into q from public.quotes where id = appr.quote_id;
  select full_name into requester from public.profiles where id = appr.requested_by;

  for a in select id from public.profiles where role = 'admin' loop
    insert into public.hub_notifications (user_id, kind, title, body, href)
    values (
      a.id,
      'quoting',
      'Quote discount needs approval',
      coalesce(nullif(requester, ''), 'A staffer')
        || ' requested >20% discount approval on '
        || coalesce(nullif(q.client_name, ''), 'a quote')
        || ' ($' || to_char(appr.quote_total, 'FM999999990.00') || ').',
      '/quoting/' || q.id::text
    );
  end loop;
end;
$$;

grant execute on function public.notify_admins_of_quote_discount(uuid)
  to authenticated;

-- Mandatory notification kind for quoting approvals.
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
        'quoting',
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
  'quoting',
  'review',
  'action',
  'action_overdue'
)
and not exists (
  select 1 from public.profiles p where p.id = m.user_id and p.role = 'admin'
);
