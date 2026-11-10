-- Run this in the VIDENT Supabase SQL editor (read-only). It returns ONE cell of SQL text.
-- Copy that cell and run it in the LRE Supabase SQL editor AFTER all migrations (including 195) are applied.
-- Everything arrives tagged owner_company = 'vident'; change owners later in LRE AV > Catalog.
select concat_ws(E'\n',
 '-- LRE Productions: AV inventory import (copied from Vident)',
 'insert into public.av_product_groups select * from json_populate_recordset(null::public.av_product_groups, ' || quote_literal((select json_agg(t) from public.av_product_groups t)::text) || ') on conflict (id) do nothing;',
 'insert into public.av_rate_definitions select * from json_populate_recordset(null::public.av_rate_definitions, ' || quote_literal((select json_agg(t) from public.av_rate_definitions t)::text) || ') on conflict (id) do nothing;',
 'insert into public.av_products select * from json_populate_recordset(null::public.av_products, ' || quote_literal((select json_agg(t) from public.av_products t)::text) || ') on conflict (id) do nothing;',
 'insert into public.av_services select * from json_populate_recordset(null::public.av_services, ' || quote_literal((select json_agg(t) from public.av_services t)::text) || ') on conflict (id) do nothing;',
 'insert into public.av_product_accessories select * from json_populate_recordset(null::public.av_product_accessories, ' || quote_literal((select json_agg(t) from public.av_product_accessories t)::text) || ') on conflict (id) do nothing;'
) as lre_inventory_import_sql;
