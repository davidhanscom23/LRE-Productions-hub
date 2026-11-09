-- Phase 2 floor ops: gear check-out / check-back ledger (KM gear_movements parity).
-- Still-out is derived in app (Σ out − Σ back per opportunity × product).

create table if not exists public.av_gear_movements (
  id               uuid primary key default gen_random_uuid(),
  opportunity_id   uuid not null references public.av_opportunities(id) on delete cascade,
  product_id       uuid not null references public.av_products(id) on delete restrict,
  line_id          uuid references public.av_opportunity_lines(id) on delete set null,
  direction        text not null check (direction in ('out', 'back')),
  qty              numeric(12,2) not null check (qty > 0),
  moved_at         timestamptz not null default now(),
  notes            text not null default '',
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists av_gear_movements_opp_idx
  on public.av_gear_movements (opportunity_id, product_id);
create index if not exists av_gear_movements_product_idx
  on public.av_gear_movements (product_id, moved_at);
create index if not exists av_gear_movements_moved_at_idx
  on public.av_gear_movements (moved_at desc);

comment on table public.av_gear_movements is
  'Warehouse ledger: gear checked out to a job or checked back in.';

alter table public.av_gear_movements enable row level security;

drop policy if exists av_gear_movements_staff_select on public.av_gear_movements;
create policy av_gear_movements_staff_select
  on public.av_gear_movements for select to authenticated
  using (public.av_erp_is_staff());

drop policy if exists av_gear_movements_staff_insert on public.av_gear_movements;
create policy av_gear_movements_staff_insert
  on public.av_gear_movements for insert to authenticated
  with check (public.av_erp_is_staff());

drop policy if exists av_gear_movements_staff_update on public.av_gear_movements;
create policy av_gear_movements_staff_update
  on public.av_gear_movements for update to authenticated
  using (public.av_erp_is_staff())
  with check (public.av_erp_is_staff());

drop policy if exists av_gear_movements_staff_delete on public.av_gear_movements;
create policy av_gear_movements_staff_delete
  on public.av_gear_movements for delete to authenticated
  using (public.av_erp_is_staff());
