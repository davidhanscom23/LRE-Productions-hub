-- Expense receipt file storage (path + provider) alongside optional external URL.
-- Hired candidates can link to an onboarding plan (idempotent).

alter table public.expense_requests
  add column if not exists receipt_storage_path text not null default '',
  add column if not exists receipt_storage_provider text not null default 'supabase'
    check (receipt_storage_provider in ('supabase', 'bunny')),
  add column if not exists receipt_file_name text not null default '';

comment on column public.expense_requests.receipt_storage_path is
  'Object path in event-media (or Bunny) for an uploaded receipt image/PDF.';
comment on column public.expense_requests.receipt_url is
  'Optional external URL (Drive etc.) and/or CDN URL after upload.';

alter table public.onboarding_plans
  add column if not exists candidate_id uuid references public.candidates (id)
    on delete set null;

create unique index if not exists onboarding_plans_candidate_uidx
  on public.onboarding_plans (candidate_id)
  where candidate_id is not null;

-- Reuse event-media bucket policies pattern via path prefix; no new bucket required.
-- Uploads go to {userId}/expenses/{uuid}.ext under the existing event-media bucket.
