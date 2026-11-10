-- LRE Productions: who owns each piece of equipment (LRE rents gear from both partner companies).
alter table public.av_products
  add column if not exists owner_company text not null default 'vident'
    check (owner_company in ('vident', 'lukesent', 'lre'));

alter table public.av_product_units
  add column if not exists owner_company text
    check (owner_company is null or owner_company in ('vident', 'lukesent', 'lre'));

comment on column public.av_products.owner_company is
  'Which company owns this equipment: vident, lukesent (Luke''s entertainment company), or lre (LRE Productions).';
comment on column public.av_product_units.owner_company is
  'Optional per-serial override of the product owner_company.';

create index if not exists av_products_owner_company_idx
  on public.av_products (owner_company);
