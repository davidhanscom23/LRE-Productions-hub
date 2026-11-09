-- Phase 2 floor ops: pre-job activities (KM activities parity).

create table if not exists public.av_activities (
  id               uuid primary key default gen_random_uuid(),
  subject          text not null,
  kind             text not null default '',
  due_at           timestamptz not null,
  opportunity_id   uuid references public.av_opportunities(id) on delete set null,
  settled_at       timestamptz,
  notes            text not null default '',
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint av_activities_subject_not_blank check (char_length(trim(subject)) > 0)
);

create index if not exists av_activities_due_open_idx
  on public.av_activities (due_at)
  where settled_at is null;
create index if not exists av_activities_opportunity_idx
  on public.av_activities (opportunity_id);

comment on table public.av_activities is
  'Pre-job tasks: what has to happen before gear goes out.';

drop trigger if exists av_activities_updated_at on public.av_activities;
create trigger av_activities_updated_at
  before update on public.av_activities
  for each row execute function public.set_updated_at();

alter table public.av_activities enable row level security;

drop policy if exists av_activities_staff_select on public.av_activities;
create policy av_activities_staff_select
  on public.av_activities for select to authenticated
  using (public.av_erp_is_staff());

drop policy if exists av_activities_staff_insert on public.av_activities;
create policy av_activities_staff_insert
  on public.av_activities for insert to authenticated
  with check (public.av_erp_is_staff());

drop policy if exists av_activities_staff_update on public.av_activities;
create policy av_activities_staff_update
  on public.av_activities for update to authenticated
  using (public.av_erp_is_staff())
  with check (public.av_erp_is_staff());

drop policy if exists av_activities_staff_delete on public.av_activities;
create policy av_activities_staff_delete
  on public.av_activities for delete to authenticated
  using (public.av_erp_is_staff());
