-- Recognitions from media a channel already holds.
--
-- An Instagram feed post shared in a DM carries no permalink, only a signed CDN link
-- to its media and the caption, and Instagram Login cannot resolve another account's
-- post to a URL. Such a task carries its content in `source_media` and is never
-- scraped. Its `source_url` is the stable `instagram-media:<media id>` URI, which keeps
-- `recognition_results.source_url` working as the per-post cache key after the CDN
-- link has expired.

alter table public.recognition_tasks
  add column source_media jsonb
    check (source_media is null or jsonb_typeof(source_media) = 'object');

comment on column public.recognition_tasks.source_media is
  'Caller-supplied content for sources that cannot be scraped ({ media_url, caption, platform, source_type }). Null for URL sources.';

comment on column public.recognition_tasks.source_url is
  'What was recognized: a post URL, or instagram-media:<id> for a post shared in an Instagram DM. Also the result cache key.';
