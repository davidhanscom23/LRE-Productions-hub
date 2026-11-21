-- Read-only summary for David's Command Center (a separate app). The link carries a secret token;
-- only its hash is stored here. The function returns counts and short lists only: no emails, phones, or notes.

create schema if not exists private;

create table if not exists private.command_center_secret (
  id          int primary key default 1 check (id = 1),
  secret_hash text not null,
  created_at  timestamptz not null default now()
);
alter table private.command_center_secret enable row level security;
revoke all on private.command_center_secret from public, anon, authenticated;

create or replace function public.command_center_summary(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_hash text;
  v_today date := (now() at time zone 'America/New_York')::date;
  v_month date := date_trunc('month', now() at time zone 'America/New_York')::date;
  v_closed text[] := array['completed', 'lost', 'archived', 'not moving forward'];
  v_booked text[] := array['booked', 'in progress', 'retainer paid', 'paid in full', 'active partner'];
  v_result jsonb;
begin
  select secret_hash into v_hash from private.command_center_secret where id = 1;
  if v_hash is null or p_token is null
     or encode(sha256(convert_to(p_token, 'utf8')), 'hex') <> v_hash then
    raise exception 'bad token';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'Leads and proposals to follow up',
        'count', (select count(*) from public.pipeline_projects
                  where btrim(stage) <> '' and lower(btrim(stage)) <> all (v_closed || v_booked)
                    and (project_date is null or project_date >= v_today)),
        'empty', 'No open leads right now.',
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('text', p.name, 'sub', p.sub))
          from (
            select name,
                   concat_ws(' · ', initcap(btrim(replace(stage, '_', ' '))), to_char(project_date, 'Mon FMDD')) as sub
            from public.pipeline_projects
            where btrim(stage) <> '' and lower(btrim(stage)) <> all (v_closed || v_booked)
              and (project_date is null or project_date >= v_today)
            order by project_date asc nulls last, created_at asc limit 5
          ) p), '[]'::jsonb)
      ),
      jsonb_build_object(
        'title', 'Upcoming booked projects',
        'count', (select count(*) from public.pipeline_projects
                  where lower(btrim(stage)) = any (v_booked) and project_date >= v_today),
        'empty', 'No upcoming booked projects.',
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('text', p.name, 'sub', p.sub))
          from (
            select name,
                   concat_ws(' · ', to_char(project_date, 'Mon FMDD'), nullif(btrim(location), '')) as sub
            from public.pipeline_projects
            where lower(btrim(stage)) = any (v_booked) and project_date >= v_today
            order by project_date asc, created_at asc limit 5
          ) p), '[]'::jsonb)
      ),
      jsonb_build_object(
        'title', 'Unpaid invoices',
        'count', (select count(*) from public.project_invoices where status in ('sent', 'partial'))
               + (select count(*) from public.av_invoices where status in ('sent', 'partial')),
        'empty', 'No unpaid invoices.',
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('text', i.label, 'sub', i.sub) order by i.due nulls last)
          from (
            select number || coalesce(' · ' || nullif(title, ''), '') as label,
                   concat_ws(' · ', case when due_at is null then null else 'due ' || to_char(due_at, 'Mon FMDD') end,
                             to_char(total - amount_paid, 'FM$999,999,990.00') || ' left') as sub,
                   due_at as due
            from public.project_invoices where status in ('sent', 'partial')
            union all
            select reference || coalesce(' · ' || nullif(subject, ''), ''),
                   concat_ws(' · ', case when due_at is null then null else 'due ' || to_char(due_at, 'Mon FMDD') end,
                             to_char(total - amount_paid, 'FM$999,999,990.00') || ' left'),
                   due_at
            from public.av_invoices where status in ('sent', 'partial')
            order by due nulls last limit 5
          ) i), '[]'::jsonb)
      ),
      jsonb_build_object(
        'title', 'Open AV quotes and orders',
        'count', (select count(*) from public.av_opportunities where status in ('quotation', 'order')),
        'empty', 'No open AV quotes or orders.',
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('text', o.label, 'sub', o.sub))
          from (
            select reference || coalesce(' · ' || nullif(subject, ''), '') as label,
                   concat_ws(' · ', initcap(status), to_char(gear_starts_at at time zone 'America/New_York', 'Mon FMDD')) as sub
            from public.av_opportunities
            where status in ('quotation', 'order')
            order by gear_starts_at asc nulls last limit 5
          ) o), '[]'::jsonb)
      )
    ),
    'money', jsonb_build_array(
      jsonb_build_object('label', 'Unpaid project invoices',
        'count', (select count(*) from public.project_invoices where status in ('sent', 'partial')),
        'total', coalesce((select sum(total - amount_paid) from public.project_invoices where status in ('sent', 'partial')), 0)),
      jsonb_build_object('label', 'Unpaid AV invoices',
        'count', (select count(*) from public.av_invoices where status in ('sent', 'partial')),
        'total', coalesce((select sum(total - amount_paid) from public.av_invoices where status in ('sent', 'partial')), 0)),
      jsonb_build_object('label', 'AV payments received this month',
        'count', (select count(*) from public.av_payments where received_at >= v_month),
        'total', coalesce((select sum(amount) from public.av_payments where received_at >= v_month), 0))
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.command_center_summary(text) from public;
grant execute on function public.command_center_summary(text) to anon, authenticated;
