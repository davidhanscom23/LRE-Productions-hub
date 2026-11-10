-- Hub switcher: point the LRE hub's tiles at the real company hubs. Safe to re-run.
insert into public.hub_links (slug, name, url, sort_order) values
  ('vident', 'Vident Productions Hub', 'https://hub.videntproductions.com', 5)
on conflict (slug) do update set name = excluded.name, url = excluded.url, sort_order = excluded.sort_order, updated_at = now();

update public.hub_links set url = 'https://hub.thehigh5guys.com', updated_at = now()
 where slug = 'high-five-guys' and url = '';

update public.hub_links
   set url = 'https://ai-growth-curve-hub.vercel.app',
       logo_url = 'https://ai-growth-curve-hub.vercel.app/hub-logos/ai-growth-curve-dark.png',
       updated_at = now()
 where slug = 'ai-growth-curve' and url = '';
