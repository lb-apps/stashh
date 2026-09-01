-- Recognition sources are no longer Instagram-only: TikTok video links are now
-- accepted by POST /api/v1/recognitions. TikTok has a single post form, so it
-- gets one `source_type` value rather than the reel/post/story split.
--
-- Widening a CHECK constraint only. No data is rewritten and every existing row
-- stays valid.

alter table public.recognition_results
  drop constraint if exists recognition_results_source_type_check;

alter table public.recognition_results
  add constraint recognition_results_source_type_check
  check (source_type in ('reel', 'post', 'story', 'tiktok'));
