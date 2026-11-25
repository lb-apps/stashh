alter table public.recognition_results
  add column if not exists transcript jsonb;

comment on column public.recognition_results.transcript is
  'Full spoken audio transcript from the video, with per-segment timestamps and per-place attribution. Null for photo posts and caption-only fallbacks.';
