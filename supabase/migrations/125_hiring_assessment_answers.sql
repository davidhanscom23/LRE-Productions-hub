-- Department assessment answers on public hiring applications.

alter table public.hiring_applications
  add column if not exists assessment_track text not null default '',
  add column if not exists assessment_answers jsonb not null default '{}'::jsonb;

comment on column public.hiring_applications.assessment_track is
  'Apply track slug: av | corporate | wedding | general (empty = legacy).';
comment on column public.hiring_applications.assessment_answers is
  'Multiple-choice working-style answers keyed by question id.';

create index if not exists hiring_applications_assessment_track_idx
  on public.hiring_applications (assessment_track)
  where char_length(trim(assessment_track)) > 0;
