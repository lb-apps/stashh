-- What each recognition was about, as a picture, and how its content was fetched.
--
-- source_thumbnail_url: the post's cover (Instagram og:image / downloader thumbnail, TikTok
--   cover, or a shared image post itself), copied into the public `source-thumbnails`
--   bucket because the platforms' CDN links expire. Null for sources with no still image
--   (a video post shared in a DM).
-- fetch_method: which path delivered the media for a run, so scraper health is visible.

alter table public.recognition_results
  add column source_thumbnail_url text;

comment on column public.recognition_results.source_thumbnail_url is
  'Durable copy of the source post''s cover image in the source-thumbnails bucket; null when the source has no still image.';

alter table public.recognition_runs
  add column fetch_method text check (fetch_method in ('scrape', 'downloader', 'tiktok', 'supplied'));

comment on column public.recognition_runs.fetch_method is
  'How the media was obtained: scrape (Instagram page), downloader (fallback), tiktok, supplied (shared in a DM).';

insert into storage.buckets (id, name, public)
values ('source-thumbnails', 'source-thumbnails', true)
on conflict (id) do nothing;

create policy "Public read source-thumbnails"
on storage.objects
for select
to public
using (bucket_id = 'source-thumbnails');
