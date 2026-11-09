-- Restrict Plaud Meetings reads to David Hanscom (owner) only.
-- Cron / sync continues via service role (bypasses RLS).

drop policy if exists "plaud_meetings read (authenticated non-guest)" on public.plaud_meetings;
drop policy if exists "plaud_meetings read (owner only)" on public.plaud_meetings;
create policy "plaud_meetings read (owner only)"
  on public.plaud_meetings for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role is distinct from 'guest'
        and (
          lower(trim(coalesce(p.full_name, ''))) = 'david hanscom'
          or lower(split_part(coalesce(p.email, ''), '@', 1)) in (
            'david.hanscom',
            'davidhanscom',
            'davidhanscom23'
          )
          or lower(coalesce(p.email, '')) = 'david@yentertainmentdjs.com'
        )
    )
  );
