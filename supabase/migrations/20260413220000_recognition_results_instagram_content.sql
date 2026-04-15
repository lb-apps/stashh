-- Store the scraped Instagram content alongside the recognition result.
-- These three fields belong to the source URL, not to individual extracted places.

alter table public.recognition_results
  add column if not exists video_url   text,
  add column if not exists caption     text,
  add column if not exists source_type text
    check (source_type in ('reel', 'post', 'story'));
