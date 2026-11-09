-- 095 Scorecards. Embedded Google Sheets reports/dashboards. Admin-only,
-- since these include financial data. (Per-card visibility can be added later.)

create table if not exists public.scorecards (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  description text not null default '',
  source_url  text not null default '',
  sort_order  int  not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint scorecards_title_not_blank check (char_length(trim(title)) > 0)
);

create index if not exists scorecards_sort_idx on public.scorecards (sort_order);

alter table public.scorecards enable row level security;

-- Admin-only read + write.
drop policy if exists "scorecards read" on public.scorecards;
create policy "scorecards read"
  on public.scorecards for select to authenticated using (public.is_admin());

drop policy if exists "scorecards write" on public.scorecards;
create policy "scorecards write"
  on public.scorecards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.scorecards to authenticated;

-- Seed the two current scorecards. (Sheets must be link-shared "anyone with the
-- link can view" for the embed to render for signed-in hub admins.)
insert into public.scorecards (title, description, source_url, sort_order)
select 'Sales Scorecard',
       'Mentor Pods sales scorecard (weekly + monthly + annual).',
       'https://docs.google.com/spreadsheets/d/1LIabipvnD4IGukrCB3TMvJl2QPI2R3pW/edit',
       10
where not exists (
  select 1 from public.scorecards where source_url like '%1LIabipvnD4IGukrCB3TMvJl2QPI2R3pW%'
);

insert into public.scorecards (title, description, source_url, sort_order)
select 'Financial Scorecard',
       'Vident Company financial scorecard.',
       'https://docs.google.com/spreadsheets/d/12R4Bx5cI4Q6O62yUA2z1jNWXFfGenmAU/edit',
       20
where not exists (
  select 1 from public.scorecards where source_url like '%12R4Bx5cI4Q6O62yUA2z1jNWXFfGenmAU%'
);
