-- Optional depth: text_kind on quote lines; venue plan attachments/markers/renders;
-- (Terminal write is API-only — no schema beyond 148 tokens.)

-- ---------------------------------------------------------------------------
-- Free-text line rental vs sale tag
-- ---------------------------------------------------------------------------
alter table public.av_opportunity_lines
  add column if not exists text_kind text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'av_opportunity_lines_text_kind_check'
  ) then
    alter table public.av_opportunity_lines
      add constraint av_opportunity_lines_text_kind_check
      check (text_kind is null or text_kind in ('rental', 'sale'));
  end if;
end $$;

comment on column public.av_opportunity_lines.text_kind is
  'For free-text lines (no product/service): rental or sale. Null = untagged / catalog line.';

-- ---------------------------------------------------------------------------
-- Opportunity room photos (venue plan base image)
-- ---------------------------------------------------------------------------
create table if not exists public.av_opportunity_attachments (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references public.av_opportunities(id) on delete cascade,
  kind            text not null default 'room_photo'
                    check (kind in ('room_photo', 'other')),
  storage_path    text not null,
  file_name       text not null default '',
  content_type    text not null default 'image/jpeg',
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint av_opportunity_attachments_path_not_blank check (
    char_length(trim(storage_path)) > 0
  )
);

create index if not exists av_opportunity_attachments_opp_idx
  on public.av_opportunity_attachments (opportunity_id, created_at desc);

comment on table public.av_opportunity_attachments is
  'Files on a quote (room photos for Venue plan).';

-- ---------------------------------------------------------------------------
-- Plan markers (normalized 0–1 x/y on the room photo)
-- ---------------------------------------------------------------------------
create table if not exists public.av_opportunity_plan_markers (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references public.av_opportunities(id) on delete cascade,
  attachment_id   uuid not null references public.av_opportunity_attachments(id) on delete cascade,
  line_id         uuid references public.av_opportunity_lines(id) on delete set null,
  label           text not null,
  x               numeric(8,6) not null check (x >= 0 and x <= 1),
  y               numeric(8,6) not null check (y >= 0 and y <= 1),
  created_at      timestamptz not null default now(),
  constraint av_opportunity_plan_markers_label_len check (
    char_length(trim(label)) between 1 and 120
  )
);

create index if not exists av_opportunity_plan_markers_opp_idx
  on public.av_opportunity_plan_markers (opportunity_id);

comment on table public.av_opportunity_plan_markers is
  'Gear placements on a venue plan photo (KM opportunity_plan_markers).';

-- ---------------------------------------------------------------------------
-- AI / manual room renders
-- ---------------------------------------------------------------------------
create table if not exists public.av_opportunity_renders (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references public.av_opportunities(id) on delete cascade,
  attachment_id   uuid references public.av_opportunity_attachments(id) on delete set null,
  storage_path    text,
  status          text not null default 'pending'
                    check (status in ('pending', 'ready', 'approved', 'rejected', 'failed')),
  prompt          text not null default '',
  error_message   text not null default '',
  show_on_estimate boolean not null default false,
  approved_by     uuid references public.profiles(id) on delete set null,
  approved_at     timestamptz,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists av_opportunity_renders_opp_idx
  on public.av_opportunity_renders (opportunity_id, created_at desc);

comment on table public.av_opportunity_renders is
  'Venue plan AI (or uploaded) renders for a quote (KM opportunity_renders).';

drop trigger if exists av_opportunity_renders_updated_at on public.av_opportunity_renders;
create trigger av_opportunity_renders_updated_at
  before update on public.av_opportunity_renders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'av-opportunity-media',
  'av-opportunity-media',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

drop policy if exists "av-opportunity-media staff select" on storage.objects;
create policy "av-opportunity-media staff select"
on storage.objects for select to authenticated
using (bucket_id = 'av-opportunity-media' and public.av_erp_is_staff());

drop policy if exists "av-opportunity-media staff insert" on storage.objects;
create policy "av-opportunity-media staff insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'av-opportunity-media' and public.av_erp_is_staff());

drop policy if exists "av-opportunity-media staff update" on storage.objects;
create policy "av-opportunity-media staff update"
on storage.objects for update to authenticated
using (bucket_id = 'av-opportunity-media' and public.av_erp_is_staff());

drop policy if exists "av-opportunity-media staff delete" on storage.objects;
create policy "av-opportunity-media staff delete"
on storage.objects for delete to authenticated
using (bucket_id = 'av-opportunity-media' and public.av_erp_is_staff());

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.av_opportunity_attachments enable row level security;
alter table public.av_opportunity_plan_markers enable row level security;
alter table public.av_opportunity_renders enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'av_opportunity_attachments',
    'av_opportunity_plan_markers',
    'av_opportunity_renders'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.av_erp_is_staff())',
      t || '_staff_select', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_staff_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.av_erp_is_staff())',
      t || '_staff_insert', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_staff_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.av_erp_is_staff()) with check (public.av_erp_is_staff())',
      t || '_staff_update', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_staff_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.av_erp_is_staff())',
      t || '_staff_delete', t
    );
  end loop;
end $$;

grant select, insert, update, delete on public.av_opportunity_attachments to authenticated, service_role;
grant select, insert, update, delete on public.av_opportunity_plan_markers to authenticated, service_role;
grant select, insert, update, delete on public.av_opportunity_renders to authenticated, service_role;
