-- Drop normalized_source_url, use source_url as the single canonical (always pre-normalized) column.
--
-- recognition_tasks  : already has source_url; drop normalized_source_url
-- recognition_results: only has normalized_source_url; rename it to source_url

-- 1. recognition_tasks: drop the redundant normalized column
alter table public.recognition_tasks
  drop column if exists normalized_source_url;

-- 2. recognition_results: rename normalized_source_url -> source_url
alter table public.recognition_results
  rename column normalized_source_url to source_url;
