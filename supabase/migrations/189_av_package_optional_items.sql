-- Optional "Comes with" items: listed on the package but not added to an
-- estimate automatically. Staff add them by hand from the package line.
alter table public.av_product_accessories
  add column if not exists is_optional boolean not null default false;
