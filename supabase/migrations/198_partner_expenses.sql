-- 198 Partner expenses: the David & Luke startup expense ledger for LRE Productions.
--
-- Security model
--  * Only the two partners listed in public.lre_partners can see or touch anything here.
--    Being a hub admin is NOT enough, so a future admin cannot read the ledger.
--  * Expenses are never deleted. A mistake is "voided" with a reason and stays on the books.
--  * Only the partner who entered an expense can edit or void it. Either partner can mark it
--    reimbursed, and the other partner can flag it with a question. Those two actions go through
--    functions that can only touch their own columns.
--  * Every create, edit, void, reimburse, flag and receipt change is written to
--    partner_expense_audit by a database trigger. Nobody can update or delete audit rows through
--    the app, and each row carries a SHA-256 hash of the row before it, so a quietly edited or
--    removed row breaks the chain. partner_audit_verify() re-checks the whole chain.
--  * Changes to the partner roster itself are logged too, including ones made outside the app.
--  * Receipts live in a private bucket that only the partners can read or add to.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- partners
create table if not exists public.lre_partners (
  user_id    uuid primary key references auth.users(id) on delete restrict,
  partner    text not null unique check (partner in ('david','luke')),
  created_at timestamptz not null default now()
);
alter table public.lre_partners enable row level security;

create or replace function public.is_lre_partner()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.lre_partners where user_id = auth.uid());
$$;

create or replace function public.my_lre_partner()
returns text
language sql stable security definer
set search_path = public
as $$
  select partner from public.lre_partners where user_id = auth.uid();
$$;

revoke all on function public.is_lre_partner() from public, anon;
revoke all on function public.my_lre_partner() from public, anon;
grant execute on function public.is_lre_partner() to authenticated;
grant execute on function public.my_lre_partner() to authenticated;

drop policy if exists "partners read roster" on public.lre_partners;
create policy "partners read roster"
  on public.lre_partners for select to authenticated
  using (public.is_lre_partner());

revoke all on public.lre_partners from anon, authenticated;
grant select on public.lre_partners to authenticated;

-- ---------------------------------------------------------------- expenses
create table if not exists public.partner_expenses (
  id             uuid primary key default gen_random_uuid(),
  paid_by        text not null check (paid_by in ('david','luke')),
  amount_cents   bigint not null check (amount_cents > 0 and amount_cents < 100000000),
  description    text not null check (length(btrim(description)) between 1 and 140),
  category       text not null default 'other'
                   check (category in ('equipment','software','legal','insurance','marketing','travel','supplies','meals','other')),
  expense_date   date not null,
  note           text not null default '' check (length(note) <= 300),
  receipt_path   text not null default '',
  receipt_name   text not null default '',
  reimbursed_at  timestamptz,
  reimbursed_by  uuid references auth.users(id),
  flagged_at     timestamptz,
  flagged_by     uuid references auth.users(id),
  flag_note      text not null default '' check (length(flag_note) <= 300),
  voided_at      timestamptz,
  voided_by      uuid references auth.users(id),
  void_reason    text not null default '' check (length(void_reason) <= 300),
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (voided_at is null or length(btrim(void_reason)) > 0)
);

create index if not exists partner_expenses_date_idx on public.partner_expenses (expense_date desc, created_at desc);
create index if not exists partner_expenses_paid_by_idx on public.partner_expenses (paid_by);

alter table public.partner_expenses enable row level security;

drop policy if exists "partners read expenses" on public.partner_expenses;
create policy "partners read expenses"
  on public.partner_expenses for select to authenticated
  using (public.is_lre_partner());

drop policy if exists "partners add own expenses" on public.partner_expenses;
create policy "partners add own expenses"
  on public.partner_expenses for insert to authenticated
  with check (
    public.is_lre_partner()
    and created_by = auth.uid()
    and voided_at is null and reimbursed_at is null and flagged_at is null
  );

-- Only the entering partner edits or voids, and only while it is not voided. There is
-- deliberately no delete policy.
drop policy if exists "creator edits own open expenses" on public.partner_expenses;
create policy "creator edits own open expenses"
  on public.partner_expenses for update to authenticated
  using (public.is_lre_partner() and created_by = auth.uid() and voided_at is null)
  with check (public.is_lre_partner() and created_by = auth.uid());

revoke all on public.partner_expenses from anon, authenticated;
grant select, insert, update on public.partner_expenses to authenticated;

-- Guard rails that RLS cannot express: locked columns, controlled void, no deletes.
create or replace function public.partner_expenses_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Partner expenses cannot be deleted. Void the expense instead.';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'That field cannot be changed.';
    end if;

    -- Reimbursement and flag columns may only change through the dedicated functions.
    if coalesce(current_setting('lre.partner_rpc', true), '') <> '1' and (
         new.reimbursed_at is distinct from old.reimbursed_at
      or new.reimbursed_by is distinct from old.reimbursed_by
      or new.flagged_at    is distinct from old.flagged_at
      or new.flagged_by    is distinct from old.flagged_by
      or new.flag_note     is distinct from old.flag_note) then
      raise exception 'Use the reimburse or flag actions for that.';
    end if;

    if old.voided_at is not null then
      raise exception 'A voided expense is final. Add a new expense instead.';
    end if;

    if new.voided_at is not null then
      new.voided_by := auth.uid();
      new.voided_at := now();
    end if;

    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists partner_expenses_guard_trg on public.partner_expenses;
create trigger partner_expenses_guard_trg
  before update or delete on public.partner_expenses
  for each row execute function public.partner_expenses_guard();

-- ---------------------------------------------------------------- audit log
create table if not exists public.partner_expense_audit (
  id              bigint generated always as identity primary key,
  at              timestamptz not null default clock_timestamp(),
  actor_id        uuid,
  actor_partner   text,
  db_role         text not null default current_user,
  action          text not null,
  expense_id      uuid,
  changed_fields  text[] not null default '{}',
  before_data     jsonb,
  after_data      jsonb,
  prev_hash       text,
  row_hash        text not null
);
create index if not exists partner_expense_audit_expense_idx on public.partner_expense_audit (expense_id);

alter table public.partner_expense_audit enable row level security;

drop policy if exists "partners read audit" on public.partner_expense_audit;
create policy "partners read audit"
  on public.partner_expense_audit for select to authenticated
  using (public.is_lre_partner());

revoke all on public.partner_expense_audit from anon, authenticated;
grant select on public.partner_expense_audit to authenticated;

create or replace function public.partner_audit_hash(
  p_prev text, p_at timestamptz, p_actor uuid, p_action text, p_expense uuid, p_before jsonb, p_after jsonb
) returns text
language sql immutable
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      coalesce(p_prev, '') || '|' ||
      to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' ||
      coalesce(p_actor::text, '') || '|' || p_action || '|' ||
      coalesce(p_expense::text, '') || '|' ||
      coalesce(p_before::text, '') || '|' || coalesce(p_after::text, ''),
      'sha256'),
    'hex');
$$;

create or replace function public.partner_audit_append(
  p_action text, p_expense uuid, p_fields text[], p_before jsonb, p_after jsonb
) returns void
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_prev text;
  v_at   timestamptz := clock_timestamp();
  v_actor uuid := auth.uid();
begin
  perform pg_advisory_xact_lock(hashtext('partner_expense_audit'));
  select row_hash into v_prev from public.partner_expense_audit order by id desc limit 1;
  insert into public.partner_expense_audit
    (at, actor_id, actor_partner, action, expense_id, changed_fields, before_data, after_data, prev_hash, row_hash)
  values
    (v_at, v_actor, (select partner from public.lre_partners where user_id = v_actor),
     p_action, p_expense, coalesce(p_fields, '{}'), p_before, p_after, v_prev,
     public.partner_audit_hash(v_prev, v_at, v_actor, p_action, p_expense, p_before, p_after));
end;
$$;
revoke all on function public.partner_audit_append(text, uuid, text[], jsonb, jsonb) from public, anon, authenticated;

-- Append-only: nobody updates, deletes or truncates audit rows.
create or replace function public.partner_audit_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The audit log is append-only.';
end;
$$;
drop trigger if exists partner_audit_no_change on public.partner_expense_audit;
create trigger partner_audit_no_change
  before update or delete on public.partner_expense_audit
  for each row execute function public.partner_audit_immutable();
drop trigger if exists partner_audit_no_truncate on public.partner_expense_audit;
create trigger partner_audit_no_truncate
  before truncate on public.partner_expense_audit
  for each statement execute function public.partner_audit_immutable();

-- Log every expense change and tell the other partner.
create or replace function public.partner_expenses_log()
returns trigger
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_action text;
  v_fields text[];
  v_before jsonb;
  v_after  jsonb := to_jsonb(new);
  v_actor  uuid := auth.uid();
  v_other  uuid;
  v_who    text;
  v_title  text;
  v_amount text := '$' || to_char(new.amount_cents / 100.0, 'FM999,999,990.00');
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
    v_fields := array(select jsonb_object_keys(v_after));
  else
    v_before := to_jsonb(old);
    v_fields := array(
      select n.key from jsonb_each(v_after) n
      where n.key <> 'updated_at' and n.value is distinct from (v_before -> n.key));
    if coalesce(array_length(v_fields, 1), 0) = 0 then
      return new;
    end if;
    if old.voided_at is null and new.voided_at is not null then
      v_action := 'voided';
    elsif old.reimbursed_at is null and new.reimbursed_at is not null then
      v_action := 'reimbursed';
    elsif old.reimbursed_at is not null and new.reimbursed_at is null then
      v_action := 'reimbursement_undone';
    elsif old.flagged_at is null and new.flagged_at is not null then
      v_action := 'flagged';
    elsif old.flagged_at is not null and new.flagged_at is null then
      v_action := 'flag_cleared';
    elsif v_fields = array['receipt_path','receipt_name'] or v_fields = array['receipt_name','receipt_path'] then
      v_action := 'receipt_changed';
    else
      v_action := 'edited';
    end if;
  end if;

  perform public.partner_audit_append(v_action, new.id, v_fields, v_before, v_after);

  -- Heads-up for the other partner (best effort; the audit row above is the record).
  select user_id into v_other from public.lre_partners where user_id is distinct from v_actor limit 1;
  select partner into v_who from public.lre_partners where user_id = v_actor;
  if v_other is not null and v_actor is not null then
    v_title := case v_action
      when 'created' then 'New partner expense'
      when 'edited' then 'Partner expense edited'
      when 'voided' then 'Partner expense voided'
      when 'reimbursed' then 'Partner expense marked reimbursed'
      when 'reimbursement_undone' then 'Reimbursement undone'
      when 'flagged' then 'Partner expense flagged'
      when 'flag_cleared' then 'Flag cleared'
      else null end;
    if v_title is not null then
      insert into public.hub_notifications (user_id, kind, title, body, href)
      values (v_other, 'partner_expense', v_title,
              initcap(coalesce(v_who, 'A partner')) || ': ' || v_amount || ' · ' || left(new.description, 80),
              '/partner-expenses');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists partner_expenses_log_trg on public.partner_expenses;
create trigger partner_expenses_log_trg
  after insert or update on public.partner_expenses
  for each row execute function public.partner_expenses_log();

-- Log roster changes, including ones made straight in SQL (actor shows as the database role).
create or replace function public.lre_partners_log()
returns trigger
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform public.partner_audit_append(
    'roster_' || lower(tg_op), null, '{}',
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;
drop trigger if exists lre_partners_log_trg on public.lre_partners;
create trigger lre_partners_log_trg
  after insert or update or delete on public.lre_partners
  for each row execute function public.lre_partners_log();

-- ---------------------------------------------------------------- reimburse / flag
create or replace function public.partner_expense_set_reimbursed(p_id uuid, p_reimbursed boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare r public.partner_expenses%rowtype;
begin
  if not public.is_lre_partner() then raise exception 'Not allowed.'; end if;
  select * into r from public.partner_expenses where id = p_id;
  if not found then raise exception 'Expense not found.'; end if;
  if r.voided_at is not null then raise exception 'That expense is voided.'; end if;
  perform set_config('lre.partner_rpc', '1', true);
  update public.partner_expenses
     set reimbursed_at = case when p_reimbursed then now() else null end,
         reimbursed_by = case when p_reimbursed then auth.uid() else null end
   where id = p_id;
end;
$$;

create or replace function public.partner_expense_set_flag(p_id uuid, p_flagged boolean, p_note text default '')
returns void
language plpgsql security definer
set search_path = public
as $$
declare r public.partner_expenses%rowtype;
begin
  if not public.is_lre_partner() then raise exception 'Not allowed.'; end if;
  select * into r from public.partner_expenses where id = p_id;
  if not found then raise exception 'Expense not found.'; end if;
  if r.voided_at is not null then raise exception 'That expense is voided.'; end if;
  if p_flagged and r.created_by = auth.uid() then
    raise exception 'You can only flag your partner''s expenses.';
  end if;
  perform set_config('lre.partner_rpc', '1', true);
  update public.partner_expenses
     set flagged_at = case when p_flagged then now() else null end,
         flagged_by = case when p_flagged then auth.uid() else null end,
         flag_note  = case when p_flagged then left(coalesce(p_note, ''), 300) else '' end
   where id = p_id;
end;
$$;

revoke all on function public.partner_expense_set_reimbursed(uuid, boolean) from public, anon;
revoke all on function public.partner_expense_set_flag(uuid, boolean, text) from public, anon;
grant execute on function public.partner_expense_set_reimbursed(uuid, boolean) to authenticated;
grant execute on function public.partner_expense_set_flag(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------- verify the chain
create or replace function public.partner_audit_verify()
returns table (ok boolean, rows_checked bigint, first_bad_id bigint)
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  r record;
  v_prev text := null;
  v_n bigint := 0;
begin
  if not public.is_lre_partner() then raise exception 'Not allowed.'; end if;
  for r in select * from public.partner_expense_audit order by id loop
    v_n := v_n + 1;
    if r.prev_hash is distinct from v_prev
       or r.row_hash <> public.partner_audit_hash(r.prev_hash, r.at, r.actor_id, r.action, r.expense_id, r.before_data, r.after_data) then
      return query select false, v_n, r.id;
      return;
    end if;
    v_prev := r.row_hash;
  end loop;
  return query select true, v_n, null::bigint;
end;
$$;
revoke all on function public.partner_audit_verify() from public, anon;
grant execute on function public.partner_audit_verify() to authenticated;

-- ---------------------------------------------------------------- receipts bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-receipts', 'partner-receipts', false, 12582912,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "partners read receipts" on storage.objects;
create policy "partners read receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'partner-receipts' and public.is_lre_partner());

drop policy if exists "partners add receipts" on storage.objects;
create policy "partners add receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'partner-receipts' and public.is_lre_partner());
-- No update or delete policy: a receipt, once uploaded, stays.
