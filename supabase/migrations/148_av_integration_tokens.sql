-- KM Terminal Mode / Developer API keys: hashed shop tokens for Claude/scripts.

create table if not exists public.av_integration_tokens (
  id            uuid primary key default gen_random_uuid(),
  label         text not null,
  kind          text not null default 'api'
                  check (kind in ('api', 'calendar')),
  token_prefix  text not null,
  token_hash    text not null,
  scopes        text[] not null default array['read']::text[],
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint av_integration_tokens_label_len check (
    char_length(trim(label)) between 1 and 60
  ),
  constraint av_integration_tokens_prefix_not_blank check (
    char_length(trim(token_prefix)) > 0
  ),
  constraint av_integration_tokens_hash_not_blank check (
    char_length(trim(token_hash)) > 0
  ),
  constraint av_integration_tokens_scopes_ok check (
    scopes <@ array['read', 'write']::text[]
    and cardinality(scopes) >= 1
  )
);

create unique index if not exists av_integration_tokens_hash_key
  on public.av_integration_tokens (token_hash);
create index if not exists av_integration_tokens_active_idx
  on public.av_integration_tokens (created_at desc)
  where revoked_at is null;

comment on table public.av_integration_tokens is
  'Developer/API keys for Terminal Mode (Claude/scripts). Store hash only; plaintext shown once on create.';

alter table public.av_integration_tokens enable row level security;

do $$
declare
  t text := 'av_integration_tokens';
begin
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
end $$;

grant select, insert, update, delete on public.av_integration_tokens to authenticated, service_role;
