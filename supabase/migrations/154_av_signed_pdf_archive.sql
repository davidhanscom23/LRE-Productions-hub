-- Immutable signed PDF archive path on customer e-sign audit rows.
-- Also allow PDF objects in av-opportunity-media (was image-only for venue plans).

alter table public.av_customer_document_signatures
  add column if not exists signed_pdf_storage_path text not null default '';

comment on column public.av_customer_document_signatures.signed_pdf_storage_path is
  'Path in av-opportunity-media for the stamped signed PDF written at accept (immutable).';

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf'
]
where id = 'av-opportunity-media';
